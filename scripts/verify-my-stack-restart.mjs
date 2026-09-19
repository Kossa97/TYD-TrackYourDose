// Run with: npx tsx scripts/verify-my-stack-restart.mjs <owned-container> <fixture-db>
// The SQL fixture must already have applied enforcement. All rows roll back.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { resolveCycleAt } from '../src/lib/planTimeline.ts'
import { resolveTimelineIntakesForDay as resolveTS } from '../src/lib/intakeSchedule.ts'
import { resolveTimelineIntakesForDay as resolveNode } from '../api/_lib/planTimeline.js'

const [container, database] = process.argv.slice(2)
assert.ok(container && database, 'An explicitly owned container and fixture database are required')
const startedAt = '2026-09-18T00:30:00.000Z'
for (const cadence of [
  { frequency: 'Alle X Tage', x_days_interval: 2, interval_unit: 'day' },
  { frequency: 'Alle X Tage', x_days_interval: 1, interval_unit: 'month' },
  { frequency: 'Im Wechsel', cycle_on_days: 1, cycle_off_days: 1 },
]) {
  const schedule = { ...cadence, intake_time: 'abends', intake_time_custom: '23:00', dose: 1, unit: 'mg', method: 'Oral', _timezone: 'America/New_York' }
  const sql = `
    begin;
    insert into stack_items(id,user_id) values ('99500000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003');
    insert into cycles(id,user_id,stack_item_id,start_date,started_at,ended_at,active) values
      ('99500000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','99500000-0000-0000-0000-000000000001','2020-01-01','2020-01-01Z','2020-01-02Z',false);
    set role authenticated;
    set request.jwt.claim.sub='30000000-0000-0000-0000-000000000003';
    create temp table restart_result as select restart_cycle('99500000-0000-0000-0000-000000000002','${startedAt}','${JSON.stringify(schedule)}','restart-real-rpc') result;
    select jsonb_build_object('cycle',to_jsonb(c),'versions',(select jsonb_agg(v) from cycle_plan_versions v where v.cycle_id=c.id),'pauses','[]'::jsonb)
      from cycles c where c.id=(select (result->>'cycle_id')::uuid from restart_result);
    rollback;
  `
  const output = execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-XAtq', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' })
  const timeline = JSON.parse(output.trim())
  const days = cadence.interval_unit === 'month' ? ['2026-10-17', '2026-10-18'] : ['2026-09-19', '2026-09-20', '2026-09-21']
  const expected = cadence.interval_unit === 'month' ? ['2026-10-17'] : ['2026-09-19', '2026-09-21']
  const observed = {}
  for (const [name, resolve] of [['TS', resolveTS], ['Node', resolveNode]]) {
    for (const zone of ['America/New_York', 'Europe/Berlin', 'Asia/Tokyo']) {
      observed[`${name}/${zone}`] = days.filter(day => resolve(timeline, day, zone).length === 1)
    }
  }
  console.log(JSON.stringify({ cadence, anchor: timeline.cycle.start_local_date, observed }))
  for (const actual of Object.values(observed)) assert.deepEqual(actual, expected, 'Restart calendar cadence changed with viewer timezone')
  assert.equal(timeline.cycle.start_local_date, '2026-09-17')
  assert.equal(timeline.cycle.lifecycle_timezone, 'America/New_York')
  assert.equal(new Date(timeline.cycle.started_at).toISOString(), startedAt)
  assert.equal(timeline.versions[0].effective_kind, 'instant')
  assert.equal(timeline.versions[0].effective_local_date, null)
  for (const zone of ['America/New_York', 'Europe/Berlin', 'Asia/Tokyo']) {
    assert.equal(resolveCycleAt(timeline, new Date('2026-09-18T00:29:59.999Z'), zone).status, 'planned')
    assert.equal(resolveCycleAt(timeline, new Date(startedAt), zone).status, 'active')
  }
}
console.log('Real restart RPC → TS/Node occurrences: all three cadences, three zones, exact activation passed')
