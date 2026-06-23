// src/components/injection3d/InjectionMapCanvas.tsx
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { inferBodyRegion } from '../../lib/injectionGeometry'
import type { InjectionLog3D, InjectionPinDraft } from '../../lib/injectionLogTypes'
import { InjectionPin } from './InjectionPin'

const MODEL_VERSION = 'placeholder-v1'
const LONG_PRESS_MS = 420

function toJson(v: THREE.Vector3) {
  return { x: Number(v.x.toFixed(5)), y: Number(v.y.toFixed(5)), z: Number(v.z.toFixed(5)) }
}

function PlaceholderTorso({
  onLongPress,
}: {
  onLongPress: (event: ThreeEvent<PointerEvent>) => void
}) {
  const timer = useRef<number | null>(null)

  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#c9a58f',
    roughness: 0.58,
    metalness: 0.04,
  }), [])

  const armMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#b8927d',
    roughness: 0.62,
    metalness: 0.03,
  }), [])

  const startPress = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onLongPress(event), LONG_PRESS_MS)
  }

  const cancelPress = () => {
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = null
  }

  const handlers = {
    onPointerDown: startPress,
    onPointerUp: cancelPress,
    onPointerLeave: cancelPress,
    onPointerMove: cancelPress,
  }

  return (
    <group>
      <mesh {...handlers} material={material} scale={[0.72, 1.05, 0.34]} position={[0, 0.18, 0]}>
        <capsuleGeometry args={[0.52, 1.05, 18, 36]} />
      </mesh>
      <mesh {...handlers} material={armMaterial} scale={[0.22, 0.75, 0.22]} rotation={[0, 0, 0.22]} position={[-0.74, 0.08, 0]}>
        <capsuleGeometry args={[0.23, 0.9, 12, 24]} />
      </mesh>
      <mesh {...handlers} material={armMaterial} scale={[0.22, 0.75, 0.22]} rotation={[0, 0, -0.22]} position={[0.74, 0.08, 0]}>
        <capsuleGeometry args={[0.23, 0.9, 12, 24]} />
      </mesh>
      <mesh {...handlers} material={material} scale={[0.28, 0.85, 0.26]} position={[-0.28, -0.92, 0]}>
        <capsuleGeometry args={[0.22, 0.85, 12, 24]} />
      </mesh>
      <mesh {...handlers} material={material} scale={[0.28, 0.85, 0.26]} position={[0.28, -0.92, 0]}>
        <capsuleGeometry args={[0.22, 0.85, 12, 24]} />
      </mesh>
    </group>
  )
}

function Scene({
  draftPin,
  logs,
  visibleLogIds,
  onDraftPinChange,
  onLogFocus,
}: {
  draftPin: InjectionPinDraft | null
  logs: InjectionLog3D[]
  visibleLogIds: Set<string>
  onDraftPinChange: (pin: InjectionPinDraft) => void
  onLogFocus: (log: InjectionLog3D) => void
}) {
  const handleLongPress = (event: ThreeEvent<PointerEvent>) => {
    const point = event.point
    const normal = event.face?.normal.clone() ?? new THREE.Vector3(0, 0, 1)
    normal.transformDirection(event.object.matrixWorld)
    const inferred = inferBodyRegion(toJson(point))
    onDraftPinChange({
      model_version: MODEL_VERSION,
      position: toJson(point),
      normal: toJson(normal.normalize()),
      body_region: inferred.body_region,
      body_side: inferred.body_side,
      uv: event.uv ? { x: Number(event.uv.x.toFixed(5)), y: Number(event.uv.y.toFixed(5)) } : null,
      camera_state: null,
    })
  }

  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[2.5, 3, 3]} intensity={2.2} />
      <PlaceholderTorso onLongPress={handleLongPress} />
      {logs.filter(log => visibleLogIds.has(log.id)).map(log => (
        <InjectionPin key={log.id} position={log.position} reference onClick={() => onLogFocus(log)} />
      ))}
      {draftPin && <InjectionPin position={draftPin.position} active />}
      <ContactShadows opacity={0.22} scale={4} blur={2.5} far={3} position={[0, -1.55, 0]} />
      <OrbitControls enablePan enableZoom enableRotate minDistance={1.4} maxDistance={4.5} target={[0, -0.05, 0]} />
      <Environment preset="city" />
    </>
  )
}

export function InjectionMapCanvas(props: {
  draftPin: InjectionPinDraft | null
  logs: InjectionLog3D[]
  visibleLogIds: Set<string>
  onDraftPinChange: (pin: InjectionPinDraft) => void
  onLogFocus: (log: InjectionLog3D) => void
}) {
  return (
    <div style={{ position: 'relative', minHeight: 'min(76vh, 760px)', borderRadius: 24, overflow: 'hidden', background: 'radial-gradient(circle at 50% 20%, rgba(0,204,245,0.16), transparent 42%), #07111d' }}>
      <Canvas camera={{ position: [0, 0.35, 2.55], fov: 42 }} dpr={[1, 1.7]}>
        <Scene {...props} />
      </Canvas>
    </div>
  )
}
