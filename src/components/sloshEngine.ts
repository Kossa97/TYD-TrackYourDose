// Damped-spring slosh physics for the vial liquid.
//
// One engine drives every vial in a view: interactions push a velocity impulse,
// an underdamped spring integrates a tilt angle that overshoots and settles, and
// an ever-advancing clock feeds the ambient ripple so the surface stays alive at
// rest. A single requestAnimationFrame loop notifies all subscribers per frame —
// subscribers update their own SVG imperatively, so there are no React re-renders
// while the liquid moves.

export interface SloshState {
  tilt: number // -1..1, the spring angle (oscillates and decays)
  energy: number // 0..1, overall agitation — scales waves and highlights
  time: number // seconds, monotonic — drives the ambient living ripple
}

type Subscriber = (state: SloshState) => void

// Tuned for a calm, realistic slosh: one soft overshoot, then settles.
const STIFFNESS = 115 // spring constant (higher = snappier, faster wobble)
const DAMPING = 7.0 // friction (lower = more overshoot / counter-swing)
const IMPULSE_GAIN = 4.6 // how hard an impulse of magnitude 1 kicks the spring
const MAX_TILT = 0.85 // clamp so even stacked drag impulses can't overturn it
const MAX_VEL = 9 // ceiling on accumulated velocity (a fast continuous drag)
const MAX_DT = 1 / 30 // clamp long frames so tab-switches don't explode the spring

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export interface SpringState {
  angle: number
  vel: number
}

// One step of the underdamped spring (semi-implicit Euler). Pure, so the physics
// character can be unit-tested without a requestAnimationFrame loop.
export function stepSlosh(state: SpringState, dt: number): SpringState {
  const acc = -STIFFNESS * state.angle - DAMPING * state.vel
  const vel = state.vel + acc * dt
  const angle = state.angle + vel * dt
  return { angle, vel }
}

export interface SloshEngine {
  pushImpulse: (velocity: number) => void
  subscribe: (cb: Subscriber) => () => void
  setEnabled: (enabled: boolean) => void
  destroy: () => void
}

export function createSloshEngine(): SloshEngine {
  let angle = 0
  let vel = 0
  let time = 0
  let last = 0
  let raf = 0
  let enabled = true
  const subs = new Set<Subscriber>()

  const snapshot = (): SloshState => ({
    tilt: clamp(angle, -MAX_TILT, MAX_TILT),
    energy: Math.min(1, Math.abs(angle) + Math.abs(vel) * 0.12),
    time,
  })

  const notify = () => {
    const s = snapshot()
    subs.forEach(cb => cb(s))
  }

  const tick = (ts: number) => {
    raf = 0
    if (!last) last = ts
    const dt = Math.min((ts - last) / 1000, MAX_DT)
    last = ts
    time += dt
    const next = stepSlosh({ angle, vel }, dt)
    angle = next.angle
    vel = next.vel
    notify()
    schedule()
  }

  function schedule() {
    if (raf || !enabled || subs.size === 0 || typeof requestAnimationFrame === 'undefined') return
    raf = requestAnimationFrame(tick)
  }

  const stop = () => {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    last = 0
  }

  return {
    pushImpulse(velocity: number) {
      if (!enabled || !Number.isFinite(velocity)) return
      vel = clamp(vel + clamp(velocity, -1, 1) * IMPULSE_GAIN, -MAX_VEL, MAX_VEL)
      schedule()
    },
    subscribe(cb: Subscriber) {
      subs.add(cb)
      cb(snapshot())
      schedule()
      return () => {
        subs.delete(cb)
        if (subs.size === 0) stop()
      }
    },
    setEnabled(value: boolean) {
      enabled = value
      if (!enabled) {
        stop()
        angle = 0
        vel = 0
        notify()
      } else {
        schedule()
      }
    },
    destroy() {
      stop()
      subs.clear()
    },
  }
}
