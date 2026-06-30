// src/components/injection3d/InjectionMapCanvas.tsx
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useGLTF } from '@react-three/drei'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react'
import * as THREE from 'three'
import { inferBodyRegion } from '../../lib/injectionGeometry'
import { prepareInjectionTorsoModel } from '../../lib/injectionModelMaterial'
import type { InjectionLog3D, InjectionPinDraft } from '../../lib/injectionLogTypes'
import { InjectionPin } from './InjectionPin'

// Coordinate space pins are placed in (the fitted visible model). Kept stable so
// region inference + proximity stay comparable across saved pins.
const MODEL_VERSION = 'placeholder-v1'
const MODEL_URL = '/models/torso_hybrid_v1.glb'
const LONG_PRESS_MS = 420

// Fit params: scale/position the model into the region-inference coordinate space
// so inferBodyRegion thresholds stay valid while the torso fills the mobile canvas.
const FIT_HEIGHT = 2.85
const FIT_Y_OFFSET = 0.12

// Camera framing so the body fills the (portrait) canvas. Lower distance = fuller.
const CAMERA_DISTANCE = 3.25
const CAMERA_FOV = 48
const SHEET_AWARE_FOCUS_Y_OFFSET = -0.22

type LightPosition = [number, number, number]

// Local lights keep the model readable from front and back without remote HDR assets.
const INJECTION_MAP_LIGHTS = {
  ambient: 1.02,
  key: { position: [2.5, 3.1, 3] as LightPosition, intensity: 2.05 },
  rearFill: { position: [-2.6, 2.4, -3.2] as LightPosition, intensity: 1.5, color: '#dff7ff' },
  rim: { position: [0, 1.4, -4.5] as LightPosition, intensity: 1.15, color: '#7dd3fc' },
  lowerFill: { position: [0, -0.55, 2.4] as LightPosition, intensity: 0.5, color: '#ffe4c7' },
}

export interface InjectionFocusRequest {
  log: InjectionLog3D
  requestId: number
  sheetOpen?: boolean
}

type OrbitControlsApi = { target: THREE.Vector3; update: () => void }

useGLTF.preload(MODEL_URL)

function toJson(v: THREE.Vector3) {
  return { x: Number(v.x.toFixed(5)), y: Number(v.y.toFixed(5)), z: Number(v.z.toFixed(5)) }
}

// Visible textured torso. Raycast directly on long-press (a one-shot pick, not
// per-frame) so pins land exactly on the surface. A decimated simplified hit
// mesh remains a worthwhile later asset-pipeline optimization.
function Torso({ onLongPress }: { onLongPress: (event: ThreeEvent<PointerEvent>) => void }) {
  const { scene } = useGLTF(MODEL_URL)
  const timer = useRef<number | null>(null)

  const model = useMemo(() => {
    const root = scene.clone(true)
    const box = new THREE.Box3().setFromObject(root)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const s = FIT_HEIGHT / size.y
    root.scale.setScalar(s)
    root.position.set(-center.x * s, -center.y * s + FIT_Y_OFFSET, -center.z * s)
    prepareInjectionTorsoModel(root)
    return root
  }, [scene])

  const startPress = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onLongPress(event), LONG_PRESS_MS)
  }

  const cancelPress = () => {
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = null
  }

  return (
    <group
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerMove={cancelPress}
    >
      <primitive object={model} />
    </group>
  )
}

// Frames the body to fill the canvas by driving the active camera + controls
// imperatively (declarative camera props don't take effect in this setup).
function applyCameraFrame(
  camera: THREE.Camera,
  controls: OrbitControlsApi | null,
) {
  const cam = camera as THREE.PerspectiveCamera
  cam.position.set(0, FIT_Y_OFFSET, CAMERA_DISTANCE)
  cam.fov = CAMERA_FOV
  cam.zoom = 1
  cam.near = 0.05
  cam.far = 50
  cam.updateProjectionMatrix()

  if (controls) {
    controls.target.set(0, FIT_Y_OFFSET, 0)
    controls.update()
  }
}

function focusTargetForRequest(point: THREE.Vector3, sheetOpen = false) {
  const target = point.clone()
  if (sheetOpen) target.y += SHEET_AWARE_FOCUS_Y_OFFSET
  return target
}

function CameraRig({ focusRequest }: { focusRequest: InjectionFocusRequest | null }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as OrbitControlsApi | null
  const warmupFrames = useRef(0)
  const animation = useRef<{
    fromPosition: THREE.Vector3
    toPosition: THREE.Vector3
    fromTarget: THREE.Vector3
    toTarget: THREE.Vector3
    progress: number
  } | null>(null)

  useLayoutEffect(() => {
    applyCameraFrame(camera, controls)
    warmupFrames.current = 0
  }, [camera, controls])

  useEffect(() => {
    if (!focusRequest || !controls) return

    const point = new THREE.Vector3(
      focusRequest.log.position.x,
      focusRequest.log.position.y,
      focusRequest.log.position.z,
    )
    const normal = new THREE.Vector3(
      focusRequest.log.normal.x,
      focusRequest.log.normal.y,
      focusRequest.log.normal.z,
    )
    if (normal.lengthSq() < 0.001) normal.set(0, 0, 1)
    normal.normalize()

    const target = focusTargetForRequest(point, focusRequest.sheetOpen)

    animation.current = {
      fromPosition: camera.position.clone(),
      toPosition: target.clone().addScaledVector(normal, 0.82),
      fromTarget: controls.target.clone(),
      toTarget: target,
      progress: 0,
    }
  }, [camera, controls, focusRequest])

  useFrame((_, delta) => {
    const active = animation.current
    if (active) {
      active.progress = Math.min(1, active.progress + delta / 0.55)
      const t = active.progress * active.progress * (3 - 2 * active.progress)
      camera.position.lerpVectors(active.fromPosition, active.toPosition, t)
      controls?.target.lerpVectors(active.fromTarget, active.toTarget, t)
      controls?.update()
      if (active.progress >= 1) animation.current = null
      return
    }

    if (warmupFrames.current >= 6) return
    applyCameraFrame(camera, controls)
    warmupFrames.current += 1
  })

  return null
}

function Scene({
  draftPin,
  logs,
  visibleLogIds,
  focusRequest,
  onDraftPinChange,
  onLogFocus,
}: {
  draftPin: InjectionPinDraft | null
  logs: InjectionLog3D[]
  visibleLogIds: Set<string>
  focusRequest: InjectionFocusRequest | null
  onDraftPinChange: (pin: InjectionPinDraft) => void
  onLogFocus: (log: InjectionLog3D) => void
}) {
  const handleLongPress = (event: ThreeEvent<PointerEvent>) => {
    const point = event.point
    const normal = event.face?.normal.clone() ?? new THREE.Vector3(0, 0, 1)
    normal.transformDirection(event.object.matrixWorld).normalize()
    const positionJson = toJson(point)
    const normalJson = toJson(normal)
    const inferred = inferBodyRegion(positionJson, normalJson)
    onDraftPinChange({
      model_version: MODEL_VERSION,
      position: positionJson,
      normal: normalJson,
      body_region: inferred.body_region,
      body_side: inferred.body_side,
      uv: event.uv ? { x: Number(event.uv.x.toFixed(5)), y: Number(event.uv.y.toFixed(5)) } : null,
      camera_state: null,
    })
  }

  return (
    <>
      <CameraRig focusRequest={focusRequest} />
      <ambientLight intensity={INJECTION_MAP_LIGHTS.ambient} />
      <directionalLight
        position={INJECTION_MAP_LIGHTS.key.position}
        intensity={INJECTION_MAP_LIGHTS.key.intensity}
      />
      <directionalLight
        position={INJECTION_MAP_LIGHTS.rearFill.position}
        intensity={INJECTION_MAP_LIGHTS.rearFill.intensity}
        color={INJECTION_MAP_LIGHTS.rearFill.color}
      />
      <directionalLight
        position={INJECTION_MAP_LIGHTS.rim.position}
        intensity={INJECTION_MAP_LIGHTS.rim.intensity}
        color={INJECTION_MAP_LIGHTS.rim.color}
      />
      <pointLight
        position={INJECTION_MAP_LIGHTS.lowerFill.position}
        intensity={INJECTION_MAP_LIGHTS.lowerFill.intensity}
        color={INJECTION_MAP_LIGHTS.lowerFill.color}
        distance={4}
      />
      <Suspense fallback={null}>
        <Torso onLongPress={handleLongPress} />
      </Suspense>
      {logs.filter(log => visibleLogIds.has(log.id)).map(log => (
        <InjectionPin key={log.id} position={log.position} normal={log.normal} reference onClick={() => onLogFocus(log)} />
      ))}
      {draftPin && <InjectionPin position={draftPin.position} normal={draftPin.normal} active />}
      <ContactShadows opacity={0.22} scale={4} blur={2.5} far={3} position={[0, -1.22, 0]} />
      <OrbitControls makeDefault enablePan enableZoom enableRotate minDistance={0.65} maxDistance={6} target={[0, FIT_Y_OFFSET, 0]} />
    </>
  )
}

export function InjectionMapCanvas({
  height = 'min(62vh, 540px)',
  minHeight = 360,
  ...props
}: {
  draftPin: InjectionPinDraft | null
  logs: InjectionLog3D[]
  visibleLogIds: Set<string>
  focusRequest: InjectionFocusRequest | null
  onDraftPinChange: (pin: InjectionPinDraft) => void
  onLogFocus: (log: InjectionLog3D) => void
  height?: CSSProperties['height']
  minHeight?: CSSProperties['minHeight']
}) {
  return (
    <div style={{ position: 'relative', height, minHeight, borderRadius: 24, overflow: 'hidden', background: 'radial-gradient(circle at 50% 20%, rgba(0,204,245,0.16), transparent 42%), #07111d' }}>
      <Canvas
        camera={{ position: [0, FIT_Y_OFFSET, CAMERA_DISTANCE], fov: CAMERA_FOV, near: 0.05, far: 50 }}
        dpr={[1, 1.7]}
        onCreated={({ camera }) => applyCameraFrame(camera, null)}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        <Scene {...props} />
      </Canvas>
    </div>
  )
}



