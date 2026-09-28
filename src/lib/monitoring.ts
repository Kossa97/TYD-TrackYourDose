import type { Breadcrumb, ErrorEvent } from '@sentry/react'

/**
 * Fehler-Monitoring (Sentry).
 *
 * Aus ohne `VITE_SENTRY_DSN`: dann wird Sentry nicht einmal geladen.
 *
 * In der Datenbank liegen Gesundheitsdaten echter Nutzer (Stack, Einnahmen,
 * Blutwerte). Nichts davon darf in einem Fehlerbericht landen. Deshalb gilt
 * hier „nur Bekanntes durchlassen", nicht „Bekanntes entfernen":
 * - Breadcrumbs: nur Seitenwechsel und Netzwerkaufrufe, beide mit Pfad ohne
 *   Parameter und ohne IDs. Klicks und Eingaben nie — Sentry beschreibt
 *   geklickte Elemente mit ihrem aria-label, und das traegt hier Namen und
 *   Mengen („BPC-157, 5 mg, 80 %").
 * - Fehlermeldungen: nur Meldungen, deren Wortlaut bekannt und frei von
 *   Nutzerdaten ist (eigene Pruefungen, Browser- und Netzfehler). Alles
 *   andere wird durch „[entfernt]" ersetzt; Typ, Stacktrace und die Stelle
 *   (`where`) bleiben — das reicht, um den Fehler zu finden.
 * - Keine Nutzerangaben, keine Anfrageinhalte, keine Sitzungen, kein Tracing.
 */

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/** Pfad einer URL ohne Parameter, Fragment und IDs; Storage-Pfade nur bis zum Bucket. */
export function scrubUrl(url: string): string {
  const cut = url.search(/[?#]/)
  let rest = cut === -1 ? url : url.slice(0, cut)
  rest = rest.replace(/(\/storage\/v1\/object\/(?:public\/|sign\/|authenticated\/)?[^/]+)\/.*/, '$1/…')
  return rest.replace(UUID, ':id')
}

// Meldungen, die nachweislich keine Nutzerdaten tragen.
const SAFE_MESSAGES: readonly RegExp[] = [
  /^Invalid stack item( setup)? draft(: [\w., ]+)?$/,
  /^My Stack: kein angemeldeter Nutzer$/,
  /^(save_stack_item|save_stack_item_with_plan) returned no data$/,
  /^Failed to fetch$/,
  /^Load failed$/,
  /^NetworkError when attempting to fetch resource\.?$/,
  /^The (operation|user) (was )?abort(ed|ed a request)\.?$/i,
  /^Failed to fetch dynamically imported module/,
  /^Importing a module script failed\.?$/,
  /^Loading (CSS )?chunk \d+ failed/,
  /^Cannot read properties of (undefined|null) \(reading '[\w$]+'\)$/,
  /^[\w$.]+ is not a function$/,
  /^[\w$.]+ is not defined$/,
  /^(undefined|null) is not an object \(evaluating '[\w$.]+'\)$/,
  /^Minified React error #\d+/,
  /^Maximum update depth exceeded/,
  /^Hydration failed/,
  /^ResizeObserver loop/,
]

export function scrubMessage(message: string): string {
  return SAFE_MESSAGES.some(pattern => pattern.test(message)) ? message : '[entfernt]'
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === 'navigation') {
    return {
      category: 'navigation',
      timestamp: breadcrumb.timestamp,
      data: {
        from: typeof breadcrumb.data?.from === 'string' ? scrubUrl(breadcrumb.data.from) : undefined,
        to: typeof breadcrumb.data?.to === 'string' ? scrubUrl(breadcrumb.data.to) : undefined,
      },
    }
  }
  if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
    return {
      category: breadcrumb.category,
      type: breadcrumb.type,
      level: breadcrumb.level,
      timestamp: breadcrumb.timestamp,
      data: {
        method: breadcrumb.data?.method,
        status_code: breadcrumb.data?.status_code,
        url: typeof breadcrumb.data?.url === 'string' ? scrubUrl(breadcrumb.data.url) : undefined,
      },
    }
  }
  return null
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const scrubbed: ErrorEvent = { ...event }
  delete scrubbed.user
  delete scrubbed.extra
  delete scrubbed.contexts
  if (scrubbed.request) {
    scrubbed.request = { url: scrubbed.request.url ? scrubUrl(scrubbed.request.url) : undefined }
  }
  if (scrubbed.message) scrubbed.message = scrubMessage(scrubbed.message)
  if (scrubbed.exception?.values) {
    scrubbed.exception = {
      ...scrubbed.exception,
      values: scrubbed.exception.values.map(value => ({
        ...value,
        value: value.value ? scrubMessage(value.value) : value.value,
      })),
    }
  }
  if (scrubbed.breadcrumbs) {
    scrubbed.breadcrumbs = scrubbed.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((breadcrumb): breadcrumb is Breadcrumb => breadcrumb !== null)
  }
  return scrubbed
}

type SentryModule = typeof import('@sentry/react')
let sentry: SentryModule | null = null

/**
 * Startet Sentry — nur mit DSN, und dann erst per dynamischem Import: ohne
 * DSN kommt das SDK gar nicht erst in den Browser.
 */
export async function initMonitoring(dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined): Promise<boolean> {
  if (!dsn) return false
  const Sentry = await import('@sentry/react')
  Sentry.init({
    dsn,
    environment: (import.meta.env.VITE_DEPLOY_ENV as string | undefined) || import.meta.env.MODE,
    release: (import.meta.env.VITE_RELEASE as string | undefined) || undefined,
    // Nur Fehler: keine Sitzungen (die gingen am beforeSend vorbei).
    integrations: defaults => defaults.filter(integration => integration.name !== 'BrowserSession'),
    beforeSend: event => scrubEvent(event),
    beforeBreadcrumb: breadcrumb => scrubBreadcrumb(breadcrumb),
  })
  sentry = Sentry
  return true
}

/**
 * Einen Fehler melden — dort, wo die App ihn selbst behandelt (etwa
 * „Speichern fehlgeschlagen"). `where` sagt, an welcher Stelle.
 */
export function reportError(error: unknown, where: string): void {
  sentry?.captureException(error, { tags: { where } })
}

/**
 * Fuer createRoot/hydrateRoot: was React nicht selbst abfaengt, melden —
 * und weiter in der Konsole zeigen wie ohne Handler.
 */
export const reactRootErrorOptions = {
  onUncaughtError: (error: unknown) => {
    console.error(error)
    reportError(error, 'react.uncaught')
  },
  onRecoverableError: (error: unknown) => {
    console.error(error)
    reportError(error, 'react.recoverable')
  },
}
