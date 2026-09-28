import { randomUUID } from 'node:crypto'
import type { Page, Route } from '@playwright/test'
import { SUBSTANCE_CATALOG } from '../../scripts/substance-catalog-source.mjs'

/**
 * Nachgebildetes Supabase fuer die Geraetetests.
 *
 * Die App spricht mit Supabase ueber PostgREST (`/rest/v1/<tabelle>`,
 * `/rest/v1/rpc/<name>`) und Auth (`/auth/v1/...`). Hier liegt dafuer ein
 * kleiner Speicher im Testprozess: Tabellen als Zeilenlisten, dazu die
 * Beziehungen, die die App einbettet (`ingredients:stack_item_ingredients(...)`),
 * und die RPCs, die My Stack zum Speichern ruft — so weit nachgebaut, wie die
 * App ihr Ergebnis liest. Keine echte Datenbank, keine echten Daten.
 *
 * Was die App anfragt und der Speicher nicht kennt, landet in `unhandled` —
 * der Test prueft am Ende, dass die Liste leer ist, damit nichts still
 * danebengeht.
 */

/** Wirft ein RPC-Handler das, antwortet der Mock wie Postgres mit einer Fehlermeldung — ein erwarteter Fehler, kein Loch im Mock. */
export class RpcError extends Error {}

export const SUPABASE_ORIGIN = 'https://xcskcojakolphtbuqfbw.supabase.co'
const STORAGE_KEY = 'sb-xcskcojakolphtbuqfbw-auth-token'

export const TEST_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'e2e@example.test',
}

type Row = Record<string, unknown>

interface CatalogSourceEntry {
  name: string
  aliases: string[]
  category: string
  dosageForms: string[]
  units: string[]
  components?: string[]
}

interface Relation {
  table: string
  /** 'many': Kinder zeigen per `foreign` auf `local` der Elternzeile. 'one': die Elternzeile zeigt per `local` auf `foreign` des Kinds. */
  kind: 'many' | 'one' | 'single-child'
  local: string
  foreign: string
}

// Nur die Beziehungen, die die App tatsaechlich einbettet.
const RELATIONS: Record<string, Record<string, Relation>> = {
  stack_items: {
    stack_item_ingredients: { table: 'stack_item_ingredients', kind: 'many', local: 'id', foreign: 'stack_item_id' },
    // Eindeutig pro Eintrag: PostgREST liefert ein Objekt, kein Array.
    stack_item_inventory: { table: 'stack_item_inventory', kind: 'single-child', local: 'id', foreign: 'stack_item_id' },
    cycle_migration_conflicts: { table: 'cycle_migration_conflicts', kind: 'many', local: 'id', foreign: 'stack_item_id' },
  },
  stack_item_ingredients: {
    substance_catalog: { table: 'substance_catalog', kind: 'one', local: 'catalog_substance_id', foreign: 'id' },
  },
  cycles: {
    stack_items: { table: 'stack_items', kind: 'one', local: 'stack_item_id', foreign: 'id' },
    cycle_plan_versions: { table: 'cycle_plan_versions', kind: 'many', local: 'id', foreign: 'cycle_id' },
    cycle_pause_periods: { table: 'cycle_pause_periods', kind: 'many', local: 'id', foreign: 'cycle_id' },
  },
}

interface SelectField {
  alias: string
  table?: string
  children?: SelectField[]
}

/** `*, inventory:stack_item_inventory(id, enabled), ingredients:stack_item_ingredients(*, substance_catalog(id))` */
function parseSelect(select: string): SelectField[] {
  const fields: SelectField[] = []
  let i = 0
  const text = select.replace(/\s+/g, '')
  while (i < text.length) {
    let token = ''
    while (i < text.length && text[i] !== ',' && text[i] !== '(') token += text[i++]
    if (text[i] === '(') {
      let depth = 1
      let inner = ''
      i++
      while (i < text.length && depth > 0) {
        if (text[i] === '(') depth++
        if (text[i] === ')') depth--
        if (depth > 0) inner += text[i]
        i++
      }
      const [alias, table] = token.includes(':') ? token.split(':') : [token, token]
      fields.push({ alias, table: table.replace(/!.*$/, ''), children: parseSelect(inner) })
    } else if (token) {
      fields.push({ alias: token })
    }
    if (text[i] === ',') i++
  }
  return fields
}

function toNumberish(value: string): unknown {
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null') return null
  return value
}

function matches(row: Row, column: string, filter: string): boolean {
  const dot = filter.indexOf('.')
  let op = filter.slice(0, dot)
  let value = filter.slice(dot + 1)
  let negate = false
  if (op === 'not') {
    negate = true
    const rest = value
    const nextDot = rest.indexOf('.')
    op = rest.slice(0, nextDot)
    value = rest.slice(nextDot + 1)
  }
  const cell = row[column]
  const result = (() => {
    switch (op) {
      case 'eq': return String(cell) === value
      case 'neq': return String(cell) !== value
      case 'is': return value === 'null' ? cell == null : cell === toNumberish(value)
      case 'in': {
        const list = value.replace(/^\(|\)$/g, '').split(',').map(entry => entry.replace(/^"|"$/g, ''))
        return list.includes(String(cell))
      }
      case 'gt': return String(cell) > value
      case 'gte': return String(cell) >= value
      case 'lt': return String(cell) < value
      case 'lte': return String(cell) <= value
      case 'ilike': {
        const pattern = new RegExp(`^${value.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/%/g, '.*')}$`, 'i')
        return pattern.test(String(cell ?? ''))
      }
      default: throw new Error(`Filter ${op} nicht nachgebildet`)
    }
  })()
  return negate ? !result : result
}

const RESERVED_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

export class MockSupabase {
  readonly tables = new Map<string, Row[]>()
  readonly rpcCalls: Array<{ name: string; params: Record<string, unknown> }> = []
  readonly unhandled: string[] = []
  /** Zaehlt jede Anfrage je `METHODE pfad`. */
  readonly log: string[] = []
  private readonly rpcHandlers = new Map<string, (params: Record<string, unknown>) => unknown>()

  constructor() {
    this.registerMyStackRpcs()
    this.seedCatalog()
  }

  /** Der echte Katalog aus der Quelldatei — dieselbe, aus der die SQL entsteht. */
  private seedCatalog(): void {
    for (const entry of SUBSTANCE_CATALOG as CatalogSourceEntry[]) {
      this.insert('substance_catalog', {
        canonical_name: entry.name,
        aliases: entry.aliases,
        default_category: entry.category,
        suggested_units: entry.units,
        suggested_dosage_forms: entry.dosageForms,
        pk_profile_id: null,
        component_names: entry.components ?? [],
        active: true,
      })
    }
  }

  catalogId(name: string): string {
    const entry = this.table('substance_catalog').find(row => row.canonical_name === name)
    if (!entry) throw new Error(`${name} steht nicht im Katalog`)
    return entry.id as string
  }

  table(name: string): Row[] {
    let rows = this.tables.get(name)
    if (!rows) {
      rows = []
      this.tables.set(name, rows)
    }
    return rows
  }

  insert(name: string, row: Row): Row {
    const now = new Date().toISOString()
    const full = { id: randomUUID(), created_at: now, updated_at: now, ...row }
    this.table(name).push(full)
    return full
  }

  /** Eine RPC direkt ausfuehren — um Ausgangsdaten anzulegen, ohne durch die Oberflaeche zu gehen. */
  callRpc(name: string, params: Record<string, unknown>): unknown {
    const handler = this.rpcHandlers.get(name)
    if (!handler) throw new Error(`rpc ${name} not mocked`)
    return handler(params)
  }

  onRpc(name: string, handler: (params: Record<string, unknown>) => unknown): void {
    this.rpcHandlers.set(name, handler)
  }

  async install(page: Page, options: { language?: string } = {}): Promise<void> {
    const session = fakeSession()
    const language = options.language ?? 'de'
    await page.addInitScript(({ key, value, userId, lang }) => {
      // Nur beim ersten Laden: ein Neuladen im Test soll den Zustand behalten.
      if (sessionStorage.getItem('__e2e_seeded')) return
      sessionStorage.setItem('__e2e_seeded', '1')
      localStorage.setItem(key, value)
      localStorage.setItem('tyd_lang', lang)
      localStorage.setItem(`tyd_lang_picked_${userId}`, '1')
      localStorage.setItem(`_ob_done_${userId}`, '1')
      localStorage.setItem('tyd_stack_colors_migrated_v1', '1')
      localStorage.setItem('tyd_push_dismissed', 'true')
      localStorage.setItem('tyd_ios_install_shown', 'true')
    }, { key: STORAGE_KEY, value: JSON.stringify(session), userId: TEST_USER.id, lang: language })

    // Alles ausser der App selbst und dem nachgebildeten Supabase bleibt aus:
    // Schriften, Analytics, Sentry. Der Test haengt so an keinem Netz.
    await page.route(url => !isLocal(url) && url.origin !== SUPABASE_ORIGIN, route => route.abort('blockedbyclient'))
    await page.route(`${SUPABASE_ORIGIN}/**`, route => this.handle(route))
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    this.log.push(`${method} ${url.pathname}`)

    if (method === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: corsHeaders() })
    }

    try {
      if (url.pathname.startsWith('/auth/v1/')) return await this.handleAuth(route, url)
      if (url.pathname.startsWith('/rest/v1/rpc/')) return await this.handleRpc(route, url)
      if (url.pathname.startsWith('/rest/v1/')) return await this.handleRest(route, url)
      if (url.pathname.startsWith('/functions/v1/') || url.pathname.startsWith('/storage/v1/')) {
        this.unhandled.push(`${method} ${url.pathname}`)
        return route.fulfill({ status: 404, headers: corsHeaders(), json: { message: 'not mocked' } })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.unhandled.push(`${method} ${url.pathname}${url.search}: ${message}`)
      return route.fulfill({ status: 400, headers: corsHeaders(), json: { message, code: 'E2E' } })
    }
    this.unhandled.push(`${method} ${url.pathname}`)
    return route.fulfill({ status: 404, headers: corsHeaders(), json: { message: 'not mocked' } })
  }

  private async handleAuth(route: Route, url: URL): Promise<void> {
    if (url.pathname === '/auth/v1/user') {
      return route.fulfill({ headers: corsHeaders(), json: fakeSession().user })
    }
    if (url.pathname === '/auth/v1/logout') {
      return route.fulfill({ status: 204, headers: corsHeaders() })
    }
    if (url.pathname === '/auth/v1/token') {
      return route.fulfill({ headers: corsHeaders(), json: fakeSession() })
    }
    this.unhandled.push(`AUTH ${url.pathname}`)
    return route.fulfill({ status: 404, headers: corsHeaders(), json: { message: 'not mocked' } })
  }

  private async handleRpc(route: Route, url: URL): Promise<void> {
    const name = url.pathname.slice('/rest/v1/rpc/'.length)
    const params = (route.request().postDataJSON() ?? {}) as Record<string, unknown>
    this.rpcCalls.push({ name, params })
    const handler = this.rpcHandlers.get(name)
    if (!handler) {
      this.unhandled.push(`RPC ${name}`)
      return route.fulfill({ status: 404, headers: corsHeaders(), json: { message: `rpc ${name} not mocked` } })
    }
    try {
      const result = handler(params)
      return await route.fulfill({ headers: corsHeaders(), json: result ?? null })
    } catch (error) {
      if (!(error instanceof RpcError)) throw error
      return route.fulfill({ status: 400, headers: corsHeaders(), json: { code: 'P0001', message: error.message, details: null, hint: null } })
    }
  }

  private async handleRest(route: Route, url: URL): Promise<void> {
    const request = route.request()
    const method = request.method()
    const tableName = url.pathname.slice('/rest/v1/'.length)
    const headers = request.headers()
    const wantsObject = (headers.accept ?? '').includes('vnd.pgrst.object')
    const prefer = headers.prefer ?? ''
    const filters = [...url.searchParams.entries()].filter(([key]) => !RESERVED_PARAMS.has(key))
    const rows = this.table(tableName)
    const selected = () => rows.filter(row => filters.every(([column, filter]) => {
      if (column === 'or' || column === 'and') throw new Error(`${column}-Filter nicht nachgebildet`)
      return matches(row, column, filter)
    }))

    const respond = (result: Row[]) => {
      const shaped = result.map(row => this.shape(tableName, row, parseSelect(url.searchParams.get('select') ?? '*')))
      if (method === 'HEAD' || prefer.includes('count=')) {
        const range = `0-${Math.max(0, shaped.length - 1)}/${shaped.length}`
        if (method === 'HEAD') return route.fulfill({ status: 200, headers: { ...corsHeaders(), 'content-range': range } })
      }
      if (wantsObject) {
        if (shaped.length !== 1) {
          return route.fulfill({
            status: 406,
            headers: corsHeaders(),
            json: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `${shaped.length} rows`, hint: null },
          })
        }
        return route.fulfill({ headers: corsHeaders(), json: shaped[0] })
      }
      return route.fulfill({ headers: corsHeaders(), json: shaped })
    }

    if (method === 'GET' || method === 'HEAD') {
      let result = selected()
      const order = url.searchParams.get('order')
      if (order) result = sortRows(result, order)
      const limit = url.searchParams.get('limit')
      if (limit) result = result.slice(0, Number(limit))
      return respond(result)
    }

    const returnRows = prefer.includes('return=representation')
    const body = request.postDataJSON() as Row | Row[] | null

    if (method === 'POST') {
      const incoming = Array.isArray(body) ? body : [body ?? {}]
      const saved = incoming.map(row => {
        if (prefer.includes('resolution=merge-duplicates')) {
          const conflict = (url.searchParams.get('on_conflict') ?? 'id').split(',')
          const existing = rows.find(candidate => conflict.every(column => candidate[column] === row[column]))
          if (existing) return Object.assign(existing, row, { updated_at: new Date().toISOString() })
        }
        return this.insert(tableName, { user_id: TEST_USER.id, ...row })
      })
      return returnRows ? respond(saved) : route.fulfill({ status: 201, headers: corsHeaders() })
    }

    if (method === 'PATCH') {
      const changed = selected().map(row => Object.assign(row, body, { updated_at: new Date().toISOString() }))
      return returnRows ? respond(changed) : route.fulfill({ status: 204, headers: corsHeaders() })
    }

    if (method === 'DELETE') {
      const doomed = new Set(selected())
      this.tables.set(tableName, rows.filter(row => !doomed.has(row)))
      return returnRows ? respond([...doomed]) : route.fulfill({ status: 204, headers: corsHeaders() })
    }

    throw new Error(`${method} nicht nachgebildet`)
  }

  /** Eine Zeile so zurueckgeben, wie PostgREST sie fuer `select` einbettet. */
  private shape(tableName: string, row: Row, fields: SelectField[]): Row {
    const out: Row = {}
    const all = fields.some(field => field.alias === '*' && !field.children)
    if (all) Object.assign(out, row)
    for (const field of fields) {
      if (!field.children) {
        if (field.alias !== '*') {
          const [alias, column] = field.alias.includes(':') ? field.alias.split(':') : [field.alias, field.alias]
          out[alias] = row[column.replace(/::\w+$/, '')] ?? null
        }
        continue
      }
      const relation = RELATIONS[tableName]?.[field.table!]
      if (!relation) throw new Error(`Einbettung ${tableName} -> ${field.table} nicht nachgebildet`)
      const related = this.table(relation.table)
      if (relation.kind === 'one') {
        const child = related.find(candidate => candidate[relation.foreign] === row[relation.local])
        out[field.alias] = child ? this.shape(relation.table, child, field.children) : null
      } else {
        const children = related
          .filter(candidate => candidate[relation.foreign] === row[relation.local])
          .map(child => this.shape(relation.table, child, field.children!))
        out[field.alias] = relation.kind === 'single-child' ? children[0] ?? null : children
      }
    }
    return out
  }

  // ---------------------------------------------------------------------------
  // My Stack: die RPCs, mit denen Anlegen, Bearbeiten und Planaenderung
  // speichern. Nachgebaut ist, was die App danach liest — die Pruefungen der
  // echten Funktionen (supabase-my-stack-*.sql) nicht.

  private registerMyStackRpcs(): void {
    const saveItem = (item: Row, ingredients: Row[]): Row => {
      const { inventory, id, ...fields } = item as Row & { inventory?: Row }
      let saved: Row
      if (id) {
        saved = this.table('stack_items').find(row => row.id === id)!
        if (!saved) throw new Error(`stack_item ${String(id)} fehlt`)
        Object.assign(saved, fields, { updated_at: new Date().toISOString() })
        this.tables.set('stack_item_ingredients', this.table('stack_item_ingredients').filter(row => row.stack_item_id !== id))
      } else {
        saved = this.insert('stack_items', {
          user_id: TEST_USER.id,
          configuration_status: 'complete',
          archived: false,
          archived_at: null,
          ...fields,
        })
      }
      for (const ingredient of ingredients) {
        this.insert('stack_item_ingredients', { ...ingredient, stack_item_id: saved.id })
      }
      if (inventory) {
        this.insert('stack_item_inventory', {
          user_id: TEST_USER.id,
          stack_item_id: saved.id,
          batch_source: null,
          batch_file_url: null,
          opened_at: null,
          use_within_days: null,
          reconstitution_ml: null,
          ...inventory,
        })
      }
      return saved
    }

    this.onRpc('save_stack_item', params => saveItem(params.p_item as Row, params.p_ingredients as Row[]))

    this.onRpc('save_stack_item_with_plan', params => {
      const plan = params.p_plan as Row
      const saved = saveItem(params.p_item as Row, params.p_ingredients as Row[])
      const { timezone, name, start_date, end_date } = plan
      const schedule = pickSchedule(plan)
      const startDate = String(start_date)
      const cycle = this.insert('cycles', {
        user_id: TEST_USER.id,
        stack_item_id: saved.id,
        name,
        start_date: startDate,
        end_date: end_date ?? null,
        active: true,
        started_at: `${startDate}T00:00:00.000Z`,
        ended_at: null,
        start_local_date: startDate,
        end_local_date: null,
        lifecycle_timezone: timezone,
        timezone_review_required: false,
        closed_by_migration_resolution: false,
        ...schedule,
      })
      this.insert('cycle_plan_versions', {
        user_id: TEST_USER.id,
        cycle_id: cycle.id,
        effective_kind: 'local_date',
        effective_at: null,
        effective_local_date: startDate,
        change_kind: 'initial',
        ...schedule,
      })
      return saved
    })

    this.onRpc('create_plan_version', params => {
      const cycleId = params.p_cycle_id as string
      const snapshot = { ...(params.p_schedule as Row) }
      delete snapshot._timezone
      delete snapshot._effective_now
      const version = this.insert('cycle_plan_versions', {
        user_id: TEST_USER.id,
        cycle_id: cycleId,
        effective_kind: params.p_effective_kind,
        effective_at: params.p_effective_at ?? null,
        effective_local_date: params.p_effective_local_date ?? null,
        change_kind: params.p_change_kind,
        ...pickSchedule(snapshot),
      })
      const cycle = this.table('cycles').find(row => row.id === cycleId)
      if (cycle) Object.assign(cycle, pickSchedule(snapshot))
      return version
    })
  }
}

const SCHEDULE_COLUMNS = [
  'frequency', 'x_days_interval', 'interval_unit', 'cycle_on_days', 'cycle_off_days', 'schedule_days',
  'intake_time', 'intake_time_custom', 'slot_doses', 'slot_days', 'dose', 'unit', 'method',
] as const

function pickSchedule(source: Row): Row {
  return Object.fromEntries(SCHEDULE_COLUMNS.map(column => [column, source[column] ?? (column === 'schedule_days' ? [] : null)]))
}

function sortRows(rows: Row[], order: string): Row[] {
  const keys = order.split(',').map(part => {
    const [column, direction] = part.split('.')
    return { column, descending: direction === 'desc' }
  })
  return [...rows].sort((a, b) => {
    for (const { column, descending } of keys) {
      const left = String(a[column] ?? '')
      const right = String(b[column] ?? '')
      if (left !== right) return (left < right ? -1 : 1) * (descending ? -1 : 1)
    }
    return 0
  })
}

function isLocal(url: URL): boolean {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
}

function corsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,HEAD,OPTIONS',
    'access-control-expose-headers': 'content-range',
  }
}

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function fakeSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 3600
  const user = {
    id: TEST_USER.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: TEST_USER.email,
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
  }
  return {
    access_token: `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: TEST_USER.id, role: 'authenticated', exp: expiresAt })}.e2e`,
    refresh_token: 'e2e-refresh',
    token_type: 'bearer',
    expires_in: 24 * 3600,
    expires_at: expiresAt,
    user,
  }
}
