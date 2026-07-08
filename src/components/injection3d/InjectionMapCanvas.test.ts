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

  it('offsets focused injections when a tracker sheet covers the lower map area', () => {
    const source = readFileSync(new URL('./InjectionMapCanvas.tsx', import.meta.url), 'utf8')

    expect(source).toContain('sheetOpen?: boolean')
    expect(source).toContain('SHEET_AWARE_FOCUS_Y_OFFSET')
    expect(source).toContain('focusTargetForRequest')
    expect(source).toContain('focusRequest.sheetOpen')
  })

  it('renders visible history pins with age colors and selected-pin emphasis', () => {
    const source = readFileSync(new URL('./InjectionMapCanvas.tsx', import.meta.url), 'utf8')

    expect(source).toContain('activeLogId')
    expect(source).toContain('getInjectionPinAgeColor(log.logged_at')
    expect(source).toContain('active={log.id === activeLogId}')
    expect(source).toContain('color={getInjectionPinAgeColor(log.logged_at)}')
  })

  it('frames the full torso by default and exposes a reset trigger', () => {
    const source = readFileSync(new URL('./InjectionMapCanvas.tsx', import.meta.url), 'utf8')

    expect(source).toContain('const CAMERA_DISTANCE = 4.85')
    expect(source).toContain('DEFAULT_CAMERA_TARGET_Y')
    expect(source).toContain('resetRequestId')
    expect(source).toContain('resetCameraFrame(camera, controls)')
    expect(source).toContain('maxDistance={7}')
  })
  it('prevents accidental map shifting on touch screens', () => {
    const source = readFileSync(new URL('./InjectionMapCanvas.tsx', import.meta.url), 'utf8')

    expect(source).toContain('enablePan={false}')
    expect(source).toContain("touchAction: 'none'")
    expect(source).toContain("overscrollBehavior: 'none'")
    expect(source).toContain("userSelect: 'none'")
  })
})
