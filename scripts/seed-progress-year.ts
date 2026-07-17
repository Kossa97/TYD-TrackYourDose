import { supabase } from '../src/lib/supabase'
import { generateProgressYear } from './progress-year-data'

const START_DATE = '2025-07-17'
const END_DATE = '2026-07-17'
const EXPECTED_DAYS = 366
const BATCH_SIZE = 500

function fail(message: string): never {
  throw new Error(message)
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

async function main() {
  const email = process.env.SEED_EMAIL
  const password = process.env.SEED_PASSWORD
  if (!email || !password) fail('SEED_EMAIL und SEED_PASSWORD müssen gesetzt sein')

  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password })
  if (authError || !auth.user) fail(`Login fehlgeschlagen: ${authError?.message ?? 'kein Benutzer'}`)

  const userId = auth.user.id
  const { dailyRows, weightRows } = generateProgressYear({
    userId,
    startDate: START_DATE,
    endDate: END_DATE,
  })
  if (dailyRows.length !== EXPECTED_DAYS || weightRows.length !== EXPECTED_DAYS) {
    fail(`Generator lieferte nicht ${EXPECTED_DAYS} Tage`)
  }

  const { error: dailyError } = await supabase
    .from('daily_logs')
    .upsert(dailyRows, { onConflict: 'user_id,log_date' })
  if (dailyError) fail(`daily_logs konnten nicht ersetzt werden: ${dailyError.message}`)

  const weightFrom = `${START_DATE}T00:00:00.000Z`
  const weightTo = `${END_DATE}T23:59:59.999Z`
  const { error: deleteWeightError } = await supabase
    .from('weight_logs')
    .delete()
    .eq('user_id', userId)
    .gte('logged_at', weightFrom)
    .lte('logged_at', weightTo)
  if (deleteWeightError) fail(`Alte weight_logs konnten nicht entfernt werden: ${deleteWeightError.message}`)

  for (let index = 0; index < weightRows.length; index += BATCH_SIZE) {
    const { error } = await supabase.from('weight_logs').insert(weightRows.slice(index, index + BATCH_SIZE))
    if (error) fail(`weight_logs konnten nicht eingefügt werden: ${error.message}`)
  }

  const [{ data: savedDaily, error: readDailyError }, { data: savedWeights, error: readWeightError }] = await Promise.all([
    supabase
      .from('daily_logs')
      .select('log_date, energie, schlaf, wohlbefinden, libido, body_fat_pct')
      .eq('user_id', userId)
      .gte('log_date', START_DATE)
      .lte('log_date', END_DATE)
      .order('log_date'),
    supabase
      .from('weight_logs')
      .select('logged_at, weight_kg')
      .eq('user_id', userId)
      .gte('logged_at', weightFrom)
      .lte('logged_at', weightTo)
      .order('logged_at'),
  ])
  if (readDailyError) fail(`daily_logs konnten nicht verifiziert werden: ${readDailyError.message}`)
  if (readWeightError) fail(`weight_logs konnten nicht verifiziert werden: ${readWeightError.message}`)

  const daily = savedDaily ?? []
  const weights = savedWeights ?? []
  const completeDaily = daily.filter(row =>
    [row.energie, row.schlaf, row.wohlbefinden, row.libido, row.body_fat_pct].every(value => value != null),
  )
  const uniqueWeightDays = new Set(weights.map(row => String(row.logged_at).slice(0, 10)))
  const first30 = daily.slice(0, 30)
  const last30 = daily.slice(-30)

  const verified =
    daily.length === EXPECTED_DAYS
    && completeDaily.length === EXPECTED_DAYS
    && weights.length === EXPECTED_DAYS
    && uniqueWeightDays.size === EXPECTED_DAYS
    && Number(weights.at(0)?.weight_kg) === 115
    && Number(weights.at(-1)?.weight_kg) === 88
    && Number(daily.at(0)?.body_fat_pct) === 34.5
    && Number(daily.at(-1)?.body_fat_pct) === 19
    && mean(last30.map(row => Number(row.energie))) > mean(first30.map(row => Number(row.energie)))
    && mean(last30.map(row => Number(row.schlaf))) > mean(first30.map(row => Number(row.schlaf)))
    && mean(last30.map(row => Number(row.wohlbefinden))) > mean(first30.map(row => Number(row.wohlbefinden)))
    && mean(last30.map(row => Number(row.libido))) > mean(first30.map(row => Number(row.libido)))

  if (!verified) fail('Gespeicherte Werte entsprechen nicht der freigegebenen Simulation')

  console.log(JSON.stringify({
    range: { from: START_DATE, to: END_DATE },
    dailyLogs: { rows: daily.length, complete: completeDaily.length },
    weightLogs: {
      rows: weights.length,
      uniqueDays: uniqueWeightDays.size,
      startKg: Number(weights.at(0)?.weight_kg),
      endKg: Number(weights.at(-1)?.weight_kg),
    },
    bodyFat: {
      startPct: Number(daily.at(0)?.body_fat_pct),
      endPct: Number(daily.at(-1)?.body_fat_pct),
    },
    verified,
  }, null, 2))

  await supabase.auth.signOut()
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
