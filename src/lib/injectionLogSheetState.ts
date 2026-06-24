export type InjectionEntryMode = 'intake' | 'manual'

export function areInjectionDetailsLocked(
  mode: InjectionEntryMode,
  hasSelectedIntake: boolean,
): boolean {
  return mode === 'intake' && hasSelectedIntake
}
