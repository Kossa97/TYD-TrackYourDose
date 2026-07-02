export type InjectionEntryMode = 'intake' | 'manual'

export function areInjectionDetailsLocked(
  mode: InjectionEntryMode,
  hasSelectedIntake: boolean,
): boolean {
  return mode === 'intake' && hasSelectedIntake
}

export function replaceTimeInLocalDateTime(
  localDateTime: string,
  time: string,
): string {
  return `${localDateTime.slice(0, 10)}T${time}`
}

export function injectionSaveActionLabel(
  status: 'open' | 'confirmed',
): string {
  return status === 'confirmed'
    ? 'Injektionsstelle hinzufügen'
    : 'Speichern & bestätigen'
}
