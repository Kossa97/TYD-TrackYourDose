// src/components/injection3d/InjectionPin.tsx
import { useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Vector3Json } from '../../lib/injectionLogTypes'

// Local axis the pin points along (head end). Oriented to the surface normal.
const PIN_AXIS = new THREE.Vector3(0, 1, 0)
const ACTIVE_HEAD = '#2b82d9'
const REFERENCE_HEAD = '#8a94a6'
const STEM_COLOR = '#c4c9d4'
const HEAD_RADIUS = 0.032
const STEM_LENGTH = 0.07
const TILT = 0.3 // ~17° lean, like a real pushpin

// Realistic "pushpin" injection marker: a glossy ball head on a thin tapered
// metallic needle, stuck into the skin and leaning naturally. The active pin is
// full-size with a saturated blue head; old reference pins are smaller with a
// muted grey head — distinct by size + colour, not colour alone.
export function InjectionPin({
  position,
  normal,
  active = false,
  reference = false,
  onClick,
}: {
  position: Vector3Json
  normal?: Vector3Json | null
  active?: boolean
  reference?: boolean
  onClick?: () => void
}) {
  const { anchor, quaternion } = useMemo(() => {
    const n = normal
      ? new THREE.Vector3(normal.x, normal.y, normal.z).normalize()
      : new THREE.Vector3(0, 1, 0)
    const q = new THREE.Quaternion().setFromUnitVectors(PIN_AXIS, n)
    return {
      anchor: [position.x, position.y, position.z] as [number, number, number],
      quaternion: q.toArray() as [number, number, number, number],
    }
  }, [position.x, position.y, position.z, normal])

  const scale = active ? 1 : 0.72
  const headColor = active ? ACTIVE_HEAD : REFERENCE_HEAD

  return (
    <group
      position={anchor}
      quaternion={quaternion}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        onClick?.()
      }}
    >
      {/* Pin body, leaning slightly from the contact point */}
      <group scale={scale} rotation={[0, 0, TILT]}>
        {/* Tapered metallic needle: thin tip at the skin, wider near the head */}
        <mesh position={[0, STEM_LENGTH / 2, 0]}>
          <cylinderGeometry args={[0.006, 0.0028, STEM_LENGTH, 16]} />
          <meshStandardMaterial color={STEM_COLOR} metalness={0.85} roughness={0.32} envMapIntensity={1} />
        </mesh>
        {/* Glossy ball head */}
        <mesh position={[0, STEM_LENGTH + HEAD_RADIUS * 0.72, 0]}>
          <sphereGeometry args={[HEAD_RADIUS, 32, 32]} />
          <meshStandardMaterial color={headColor} metalness={0.12} roughness={0.16} envMapIntensity={1.15} />
        </mesh>
      </group>
    </group>
  )
}
