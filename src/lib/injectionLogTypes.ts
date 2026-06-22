// src/lib/injectionLogTypes.ts
export type BodyRegion = 'abdomen' | 'thigh' | 'deltoid' | 'glute' | 'torso' | 'outside_typical'
export type BodySide = 'left' | 'right' | 'center'
export type InjectionVisualMode = 'clean' | 'hybrid' | 'anatomy'

export interface Vector3Json {
  x: number
  y: number
  z: number
}

export interface Vector2Json {
  x: number
  y: number
}

export interface InjectionCameraState {
  target: Vector3Json
  position: Vector3Json
  zoom?: number
}

export interface InjectionPinDraft {
  model_version: string
  position: Vector3Json
  normal: Vector3Json
  body_region: BodyRegion
  body_side: BodySide
  uv?: Vector2Json | null
  camera_state?: InjectionCameraState | null
}

export interface InjectionLog3D extends InjectionPinDraft {
  id: string
  user_id: string
  dose_log_id: string | null
  peptide_id: string | null
  cycle_id: string | null
  peptide_name: string | null
  cycle_name: string | null
  dose: number | null
  unit: string | null
  method: string | null
  notes: string | null
  logged_at: string
  created_at: string | null
  warning_state: string | null
}

export interface SelectableInjectionCycle {
  id: string
  peptide_id: string
  peptide_name: string
  cycle_name: string
  dose: number
  unit: string
  method: string
}

export interface InjectionProximityWarning {
  level: 'none' | 'caution' | 'strong'
  nearestLogId: string | null
  distance: number | null
}
