import { useCallback, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import type { Ref } from 'react'

// The stage-light channel of a stage form. The carousel pushes focus and light
// offset through here on every scroll frame, so no React render happens while
// swiping. What that turns into in the DOM is the form's own business — it
// passes an `apply` callback and writes its own attributes.
export interface StageLightHandle {
  setStageLight: (focus: number, lightOffset: number) => void
}

const clamp = (value: number, lo: number, hi: number) =>
  Number.isFinite(value) ? Math.max(lo, Math.min(hi, value)) : lo

export function clampStageLight(focus: number, lightOffset: number) {
  return { focus: clamp(focus, 0, 1), lightOffset: clamp(lightOffset, -1, 1) }
}

export function useStageLight(
  apply: (focus: number, lightOffset: number) => void,
  seed: { focus: number; lightOffset: number },
  handleRef?: Ref<StageLightHandle>,
): void {
  const stageRef = useRef(seed)

  const setStageLight = useCallback((nextFocus: number, nextLightOffset: number) => {
    const { focus, lightOffset } = clampStageLight(nextFocus, nextLightOffset)
    const stage = stageRef.current
    if (Math.abs(stage.focus - focus) < 0.005 && Math.abs(stage.lightOffset - lightOffset) < 0.005) return
    stageRef.current = { focus, lightOffset }
    apply(focus, lightOffset)
  }, [apply])

  useImperativeHandle(handleRef, () => ({ setStageLight }), [setStageLight])

  // React reconciliation may have just reset the stage-lit attributes to the
  // prop-derived render values; put the imperative state back before paint.
  useLayoutEffect(() => {
    const stage = stageRef.current
    apply(stage.focus, stage.lightOffset)
  })
}
