// src/components/injection3d/InjectionPin.tsx
import type { ThreeEvent } from '@react-three/fiber'
import type { Vector3Json } from '../../lib/injectionLogTypes'

function vectorArray(v: Vector3Json): [number, number, number] {
  return [v.x, v.y, v.z]
}

export function InjectionPin({
  position,
  active = false,
  reference = false,
  onClick,
}: {
  position: Vector3Json
  active?: boolean
  reference?: boolean
  onClick?: () => void
}) {
  const color = active ? '#38bdf8' : reference ? '#94a3b8' : '#22d3ee'
  const scale = active ? 1.2 : reference ? 0.72 : 1

  return (
    <group
      position={vectorArray(position)}
      scale={scale}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        onClick?.()
      }}
    >
      <mesh>
        <sphereGeometry args={[0.025, 24, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 1.2 : 0.45} />
      </mesh>
      <mesh position={[0, -0.055, 0]}>
        <coneGeometry args={[0.012, 0.08, 18]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} />
      </mesh>
    </group>
  )
}
