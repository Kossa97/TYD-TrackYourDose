export const STACK_ITEM_COLORS = [
  '#06b6d4',
  '#a855f7',
  '#f59e0b',
  '#ec4899',
  '#34d399',
  '#f97316',
  '#60a5fa',
  '#fb7185',
  '#2dd4bf',
  '#facc15',
  '#c084fc',
  '#4ade80',
]

export function getStackItemColor(index: number): string {
  if (index < 0) return '#64748b'
  return STACK_ITEM_COLORS[index % STACK_ITEM_COLORS.length]
}

export function getRandomStackItemColor(random: () => number = Math.random): string {
  const index = Math.min(STACK_ITEM_COLORS.length - 1, Math.floor(random() * STACK_ITEM_COLORS.length))
  return STACK_ITEM_COLORS[Math.max(0, index)]
}

export function getStableStackItemColor(id: string): string {
  let hash = 2166136261
  for (let index = 0; index < id.length; index += 1) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 16777619)
  }
  return STACK_ITEM_COLORS[(hash >>> 0) % STACK_ITEM_COLORS.length]
}
