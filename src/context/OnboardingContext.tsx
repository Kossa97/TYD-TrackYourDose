import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface OnboardingCtx {
  step:    number
  total:   number
  active:  boolean
  next:    () => void
  prev:    () => void
  skip:    () => void
  restart: () => void
}

const Ctx = createContext<OnboardingCtx | null>(null)

const TOTAL = 9

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [step,   setStep]   = useState(0)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('_ob_done')) setActive(true)
  }, [])

  const next = () => {
    if (step >= TOTAL - 1) { localStorage.setItem('_ob_done', '1'); setActive(false) }
    else setStep(s => s + 1)
  }
  const prev    = () => setStep(s => Math.max(0, s - 1))
  const skip    = () => { localStorage.setItem('_ob_done', '1'); setActive(false) }
  const restart = () => { localStorage.removeItem('_ob_done'); setStep(0); setActive(true) }

  return (
    <Ctx.Provider value={{ step, total: TOTAL, active, next, prev, skip, restart }}>
      {children}
    </Ctx.Provider>
  )
}

export function useOnboarding() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useOnboarding outside OnboardingProvider')
  return ctx
}
