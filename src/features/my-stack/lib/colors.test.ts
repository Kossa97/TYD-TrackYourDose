import { describe, expect, test } from 'vitest'
import { STACK_ITEM_COLORS, getRandomStackItemColor, getStableStackItemColor } from './colors'

describe('stack item colors', () => {
  test('returns a color from the curated palette', () => {
    expect(STACK_ITEM_COLORS).toContain(getRandomStackItemColor(() => 0))
    expect(STACK_ITEM_COLORS).toContain(getRandomStackItemColor(() => 0.999))
  })

  test('uses the supplied random source to pick stable palette entries', () => {
    expect(getRandomStackItemColor(() => 0)).toBe(STACK_ITEM_COLORS[0])
    expect(getRandomStackItemColor(() => 0.5)).toBe(STACK_ITEM_COLORS[Math.floor(STACK_ITEM_COLORS.length * 0.5)])
  })

  test('keeps the ID fallback stable across reloads', () => {
    expect(getStableStackItemColor('stack-item-1')).toBe('#fb7185')
  })
})
