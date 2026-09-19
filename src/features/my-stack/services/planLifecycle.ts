import type {
  CyclePausePeriod,
  CyclePlanVersion,
  CycleTimeline,
  TimelineCycle,
} from '../../../lib/planTimeline'
import type {
  CreatePlanVersionInput,
  EndCycleInput,
  PauseCycleInput,
  RemovePlanVersionInput,
  ReplacePlanVersionInput,
  RestartCycleInput,
  ResumeCycleInput,
  SetPauseEndInput,
} from '../types'

interface ServiceError {
  message: string
  code?: string
}

interface QueryResult<T> {
  data: T | null
  error: ServiceError | null
}

interface CycleTimelineRow extends TimelineCycle {
  versions: CyclePlanVersion[] | null
  pauses: CyclePausePeriod[] | null
}

interface CycleFilter {
  order(
    column: 'started_at',
    options: { ascending: false },
  ): PromiseLike<QueryResult<CycleTimelineRow[]>>
  single(): PromiseLike<QueryResult<CycleTimelineRow>>
}

export interface PlanQueryClient {
  from(table: 'cycles'): {
    select(columns: string): {
      eq(column: 'user_id' | 'id', value: string): CycleFilter
    }
  }
}

export interface PlanRpcClient extends PlanQueryClient {
  rpc(
    name: string,
    params: Record<string, unknown>,
  ): PromiseLike<QueryResult<unknown>>
}

export type PlanLifecycleErrorCode =
  | 'already_effective'
  | 'already_ended'
  | 'not_paused'
  | 'open_cycle_conflict'
  | 'unknown'

export class PlanLifecycleError extends Error {
  readonly code: PlanLifecycleErrorCode

  constructor(code: PlanLifecycleErrorCode, message: string) {
    super(message)
    this.name = 'PlanLifecycleError'
    this.code = code
  }
}

const TIMELINE_SELECT = `
  id,
  stack_item_id,
  started_at,
  ended_at,
  versions:cycle_plan_versions (
    id,
    cycle_id,
    effective_kind,
    effective_at,
    effective_local_date,
    change_kind,
    frequency,
    x_days_interval,
    interval_unit,
    cycle_on_days,
    cycle_off_days,
    schedule_days,
    intake_time,
    intake_time_custom,
    slot_doses,
    slot_days,
    dose,
    unit,
    method
  ),
  pauses:cycle_pause_periods (
    id,
    cycle_id,
    paused_at,
    ends_at
  )
`

function lifecycleError(error: ServiceError): PlanLifecycleError {
  let code: PlanLifecycleErrorCode = 'unknown'
  if (error.message === 'Plan version is already effective') code = 'already_effective'
  else if (error.message === 'Cycle is already ended') code = 'already_ended'
  else if (error.message === 'Cycle is not paused') code = 'not_paused'
  else if (error.message === 'Another open cycle exists') code = 'open_cycle_conflict'
  return new PlanLifecycleError(code, error.message)
}

function throwIfError(error: ServiceError | null): void {
  if (error) throw lifecycleError(error)
}

function mapTimeline(row: CycleTimelineRow): CycleTimeline {
  return {
    cycle: {
      id: row.id,
      stack_item_id: row.stack_item_id,
      started_at: row.started_at,
      ended_at: row.ended_at,
    },
    versions: row.versions ?? [],
    pauses: row.pauses ?? [],
  }
}

async function loadCycleTimeline(client: PlanQueryClient, cycleId: string): Promise<CycleTimeline> {
  const { data, error } = await client
    .from('cycles')
    .select(TIMELINE_SELECT)
    .eq('id', cycleId)
    .single()
  throwIfError(error)
  if (!data) throw new PlanLifecycleError('unknown', 'Cycle timeline not found')
  return mapTimeline(data)
}

async function callRpc<T>(
  client: PlanRpcClient,
  name: string,
  params: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.rpc(name, params)
  throwIfError(error)
  const value = Array.isArray(data) ? data[0] : data
  if (value == null) throw new PlanLifecycleError('unknown', `${name} returned no data`)
  return value as T
}

export async function loadCycleTimelines(
  client: PlanQueryClient,
  userId: string,
): Promise<CycleTimeline[]> {
  const { data, error } = await client
    .from('cycles')
    .select(TIMELINE_SELECT)
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
  throwIfError(error)
  return (data ?? []).map(mapTimeline)
}

export async function createPlanVersion(
  client: PlanRpcClient,
  input: CreatePlanVersionInput,
): Promise<CyclePlanVersion> {
  return callRpc(client, 'create_plan_version', {
    p_cycle_id: input.cycleId,
    p_effective_kind: input.effectiveKind,
    p_effective_at: input.effectiveAt,
    p_effective_local_date: input.effectiveLocalDate,
    p_change_kind: input.changeKind,
    p_schedule: input.schedule,
    p_idempotency_key: input.idempotencyKey,
  })
}

export async function replaceFuturePlanVersion(
  client: PlanRpcClient,
  input: ReplacePlanVersionInput,
): Promise<CyclePlanVersion> {
  return callRpc(client, 'replace_future_plan_version', {
    p_version_id: input.versionId,
    p_effective_kind: input.effectiveKind,
    p_effective_at: input.effectiveAt,
    p_effective_local_date: input.effectiveLocalDate,
    p_change_kind: input.changeKind,
    p_schedule: input.schedule,
    p_timezone: input.timeZone,
    p_idempotency_key: input.idempotencyKey,
  })
}

export async function removeFuturePlanVersion(
  client: PlanRpcClient,
  input: RemovePlanVersionInput,
): Promise<void> {
  await callRpc(client, 'remove_future_plan_version', {
    p_version_id: input.versionId,
    p_timezone: input.timeZone,
    p_idempotency_key: input.idempotencyKey,
  })
}

export async function pauseCycle(
  client: PlanRpcClient,
  input: PauseCycleInput,
): Promise<CycleTimeline> {
  const result = await callRpc<{ cycle_id: string }>(client, 'pause_cycle', {
    p_cycle_id: input.cycleId,
    p_ends_at: input.endsAt,
    p_idempotency_key: input.idempotencyKey,
  })
  return loadCycleTimeline(client, result.cycle_id)
}

export async function setPauseEnd(
  client: PlanRpcClient,
  input: SetPauseEndInput,
): Promise<CycleTimeline> {
  const result = await callRpc<{ cycle_id: string }>(client, 'set_pause_end', {
    p_pause_id: input.pauseId,
    p_ends_at: input.endsAt,
    p_idempotency_key: input.idempotencyKey,
  })
  return loadCycleTimeline(client, result.cycle_id)
}

export async function resumeCycle(
  client: PlanRpcClient,
  input: ResumeCycleInput,
): Promise<CycleTimeline> {
  const result = await callRpc<{ cycle_id: string }>(client, 'resume_cycle', {
    p_cycle_id: input.cycleId,
    p_idempotency_key: input.idempotencyKey,
  })
  return loadCycleTimeline(client, result.cycle_id)
}

export async function endCycle(
  client: PlanRpcClient,
  input: EndCycleInput,
): Promise<CycleTimeline> {
  const result = await callRpc<{ cycle_id: string }>(client, 'end_cycle', {
    p_cycle_id: input.cycleId,
    p_idempotency_key: input.idempotencyKey,
  })
  return loadCycleTimeline(client, result.cycle_id)
}

export async function resolveCycleMigrationConflict(
  client: PlanRpcClient,
  input: { stackItemId: string; keepCycleId: string; idempotencyKey: string },
): Promise<CycleTimeline> {
  const result = await callRpc<{ cycle_id: string }>(client, 'resolve_cycle_migration_conflict', {
    p_stack_item_id: input.stackItemId,
    p_keep_cycle_id: input.keepCycleId,
    p_idempotency_key: input.idempotencyKey,
  })
  return loadCycleTimeline(client, result.cycle_id)
}

export async function restartCycle(
  client: PlanRpcClient,
  input: RestartCycleInput,
): Promise<CycleTimeline> {
  const result = await callRpc<{ cycle_id: string }>(client, 'restart_cycle', {
    p_source_cycle_id: input.sourceCycleId,
    p_started_at: input.startedAt,
    p_initial_schedule: input.initialSchedule,
    p_idempotency_key: input.idempotencyKey,
  })
  return loadCycleTimeline(client, result.cycle_id)
}
