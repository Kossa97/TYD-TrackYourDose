import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
const STORAGE_KEY = 'tyd_theme'

function systemPrefersLight(): boolean {
  return window.matchMedia('(prefers-color-scheme: light)').matches
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return systemPrefersLight() ? 'light' : 'dark'
  return mode
}

export function getThemeMode(): ThemeMode {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

export function applyTheme(mode: ThemeMode) {
  const resolved = resolveTheme(mode)
  document.documentElement.setAttribute('data-theme', resolved)
}

export function setThemeMode(mode: ThemeMode) {
  localStorage.setItem(STORAGE_KEY, mode)
  applyTheme(mode)
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(getThemeMode)

  useEffect(() => {
    applyTheme(mode)
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode])

  const update = useCallback((next: ThemeMode) => {
    setThemeMode(next)
    setMode(next)
  }, [])

  return { mode, resolved: resolveTheme(mode), setMode: update }
}
