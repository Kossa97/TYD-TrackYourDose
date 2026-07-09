const STORAGE_KEY = 'tyd-fortschritt-entry-highlight-dismissed'

export function isProgressEntryHighlightDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissProgressEntryHighlight(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Private mode / storage voll
  }
}
