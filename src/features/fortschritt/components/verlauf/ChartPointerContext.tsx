import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

interface ChartPointerContextValue {
  pointerX: number | null
  setPointerX: (x: number | null) => void
}

const ChartPointerContext = createContext<ChartPointerContextValue | null>(null)

export function ChartPointerProvider({ children }: { children: ReactNode }) {
  const [pointerX, setPointerX] = useState<number | null>(null)
  const value = useMemo(() => ({ pointerX, setPointerX }), [pointerX])
  return (
    <ChartPointerContext.Provider value={value}>
      {children}
    </ChartPointerContext.Provider>
  )
}

export function useChartPointerX(): number | null {
  return useContext(ChartPointerContext)?.pointerX ?? null
}

export function useChartPointerSetter(): (x: number | null) => void {
  return useContext(ChartPointerContext)?.setPointerX ?? (() => {})
}
