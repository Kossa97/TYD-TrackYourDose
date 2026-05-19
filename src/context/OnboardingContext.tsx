import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import i18n, { applyDirection } from '../i18n'
import { ONBOARDING_STEP_COUNT } from '../components/onboardingSteps'
import { useAuth } from './AuthContext'

interface OnboardingCtx {
  step: number
  total: number
  active: boolean
  needsLanguagePick: boolean
  next: () => void
  prev: () => void
  skip: () => void
  restart: () => void
  confirmLanguage: (code: string) => void
}

const Ctx = createContext<OnboardingCtx | null>(null)

function getKeys(uid: string | undefined) {
  const suffix = uid ? `_${uid}` : ''
  return {
    obDoneKey: `_ob_done${suffix}`,
    langPickedKey: `tyd_lang_picked${suffix}`,
  }
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const uid = user?.id

  const [step, setStep] = useState(0)
  const [needsLanguagePick, setNeedsLanguagePick] = useState(false)
  const [active, setActive] = useState(false)
  const [ready, setReady] = useState(false)

  // Initialize / re-initialize per user after auth resolves
  useEffect(() => {
    if (authLoading) return
    const { obDoneKey, langPickedKey } = getKeys(uid)
    const langPicked = !!localStorage.getItem(langPickedKey)
    const obDone = !!localStorage.getItem(obDoneKey)
    setNeedsLanguagePick(!langPicked)
    setActive(langPicked && !obDone)
    setStep(0)
    setReady(true)
  }, [uid, authLoading])

  const confirmLanguage = useCallback((code: string) => {
    void i18n.changeLanguage(code)
    localStorage.setItem('tyd_lang', code)
    const { obDoneKey, langPickedKey } = getKeys(uid)
    localStorage.setItem(langPickedKey, '1')
    applyDirection(code)
    setNeedsLanguagePick(false)
    if (!localStorage.getItem(obDoneKey)) setActive(true)
  }, [uid])

  const next = () => {
    if (step >= ONBOARDING_STEP_COUNT - 1) {
      localStorage.setItem(getKeys(uid).obDoneKey, '1')
      setActive(false)
    } else {
      setStep(s => s + 1)
    }
  }

  const prev = () => setStep(s => Math.max(0, s - 1))

  const skip = () => {
    localStorage.setItem(getKeys(uid).obDoneKey, '1')
    setActive(false)
  }

  const restart = () => {
    localStorage.removeItem(getKeys(uid).obDoneKey)
    setStep(0)
    setActive(true)
  }

  return (
    <Ctx.Provider
      value={{
        step,
        total: ONBOARDING_STEP_COUNT,
        // Hide overlay until auth is resolved to avoid wrong-user flash
        active: ready ? active : false,
        needsLanguagePick: ready ? needsLanguagePick : false,
        next,
        prev,
        skip,
        restart,
        confirmLanguage,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useOnboarding() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useOnboarding outside OnboardingProvider')
  return ctx
}
