import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Home upcoming intake confirmation flow', () => {
  it('asks how to confirm an upcoming intake before opening linked flows', () => {
    const source = readFileSync(new URL('./Home.tsx', import.meta.url), 'utf8')

    expect(source).toContain('selectedHomeIntake')
    expect(source).toContain('HomeIntakeConfirmSheet')
    expect(source).toContain('Wie möchtest du bestätigen?')
    expect(source).toContain('HomeIntakeTimeSheet')
    expect(source).toContain('Wann hast du tatsächlich eingenommen?')
    expect(source).toContain('openHomeIntakeTimeForm(selectedHomeIntake)')
    expect(source).toContain('confirmHomeIntake(selectedHomeIntake, true, homeConfirmTime)')
    expect(source).toContain('confirmHomeIntake(selectedHomeIntake, false)')
    expect(source).toContain('openHomeIntakeInjection(selectedHomeIntake)')
    expect(source).not.toContain('onTaken={() => confirmHomeIntake(selectedHomeIntake, true)}')
    expect(source).not.toContain('const openTodayIntake = (intake: TodayIntake) => {\n    if (isInjectableMethod(intake.method))')
  })
})
