import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('InjectionMapCanvas external assets', () => {
  it('does not use drei Environment presets that fetch remote HDR files', () => {
    const source = readFileSync(new URL('./InjectionMapCanvas.tsx', import.meta.url), 'utf8')

    expect(source).not.toContain('Environment')
    expect(source).not.toContain('preset=')
  })

  it('keeps explicit rear and rim lighting for the back view', () => {
    const source = readFileSync(new URL('./InjectionMapCanvas.tsx', import.meta.url), 'utf8')

    expect(source).toContain('INJECTION_MAP_LIGHTS')
    expect(source).toContain('rearFill')
    expect(source).toContain('rim')
  })
})
