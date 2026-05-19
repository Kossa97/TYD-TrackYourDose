import { useRef, useState, useCallback, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, Capsule, Sphere } from '@react-three/drei'
import * as THREE from 'three'
import type { InjectionZone } from '../../pages/InjectionTracker3D'

// ── Color theme (mirrors app palette) ─────────────────────────────────────────
const COLORS = {
  body:        '#0d1e3d',
  bodyEdge:    '#00ccf5',
  free:        '#10b981',
  soon:        '#22c55e',
  caution:     '#eab308',
  recent:      '#f97316',
  blocked:     '#ef4444',
  recommended: '#00ccf5',
  zoneRing:    'rgba(0,204,245,0.18)',
}

function statusColor(days: number | undefined): string {
  if (days === undefined) return COLORS.free
  if (days === 0)  return COLORS.blocked
  if (days === 1)  return COLORS.recent
  if (days <= 3)   return COLORS.caution
  if (days <= 5)   return COLORS.soon
  return COLORS.free
}

// ── Rim-light body material (dark + cyan edge glow) ───────────────────────────
const bodyVertexShader = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vNormal   = normalize(normalMatrix * normal);
    vViewDir  = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`
const bodyFragShader = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vViewDir;

  uniform vec3  uBodyColor;
  uniform vec3  uRimColor;
  uniform float uRimPower;
  uniform float uAmbient;

  void main() {
    // Diffuse from top-front key light
    vec3 lightDir = normalize(vec3(0.3, 1.0, 0.6));
    float diff     = max(dot(vNormal, lightDir), 0.0) * 0.45;

    // Rim light (edge glow — cyan from behind)
    float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
    rim = pow(rim, uRimPower) * 0.55;

    // Subtle secondary light from below (fill)
    vec3 fillDir  = normalize(vec3(-0.2, -0.5, 0.4));
    float fill     = max(dot(vNormal, fillDir), 0.0) * 0.12;

    vec3 color = uBodyColor * (uAmbient + diff + fill) + uRimColor * rim;
    gl_FragColor = vec4(color, 1.0);
  }
`

function useBodyMaterial() {
  return useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   bodyVertexShader,
    fragmentShader: bodyFragShader,
    uniforms: {
      uBodyColor: { value: new THREE.Color(COLORS.body) },
      uRimColor:  { value: new THREE.Color(COLORS.bodyEdge) },
      uRimPower:  { value: 3.5 },
      uAmbient:   { value: 0.18 },
    },
  }), [])
}

// ── Procedural body ───────────────────────────────────────────────────────────
function BodyMesh() {
  const mat = useBodyMaterial()
  const args: [number, number, number] = [0, 0, 0] // dummy

  const seg = 32 // segments → smoothness
  const capsuleArgs = (r: number, l: number): [number, number, number, number] => [r, l, seg, seg]
  const sphereArgs  = (r: number): [number, number, number] => [r, seg, seg]

  return (
    <group>
      {/* ── Head ── */}
      <Sphere args={sphereArgs(0.135)} position={[0, 1.63, 0]}>
        <primitive object={mat} attach="material" />
      </Sphere>

      {/* ── Neck ── */}
      <Capsule args={capsuleArgs(0.052, 0.09)} position={[0, 1.475, 0]}>
        <primitive object={mat} attach="material" />
      </Capsule>

      {/* ── Upper torso (chest) ── */}
      <Capsule args={capsuleArgs(0.195, 0.38)} position={[0, 1.18, 0]}>
        <primitive object={mat} attach="material" />
      </Capsule>

      {/* ── Mid torso (abs/waist) ── */}
      <Capsule args={capsuleArgs(0.165, 0.26)} position={[0, 0.79, 0]}>
        <primitive object={mat} attach="material" />
      </Capsule>

      {/* ── Pelvis ── */}
      <Capsule args={capsuleArgs(0.190, 0.10)} position={[0, 0.50, 0]}>
        <primitive object={mat} attach="material" />
      </Capsule>

      {/* ── Shoulders ── */}
      {([-1, 1] as const).map(side => (
        <group key={side}>
          <Sphere args={sphereArgs(0.082)} position={[side * 0.285, 1.305, 0]}>
            <primitive object={mat} attach="material" />
          </Sphere>

          {/* Upper arm */}
          <Capsule
            args={capsuleArgs(0.066, 0.29)}
            position={[side * 0.365, 1.045, 0]}
            rotation={[0, 0, side * -0.14]}
          >
            <primitive object={mat} attach="material" />
          </Capsule>

          {/* Forearm */}
          <Capsule
            args={capsuleArgs(0.052, 0.27)}
            position={[side * 0.405, 0.685, 0]}
            rotation={[0, 0, side * -0.08]}
          >
            <primitive object={mat} attach="material" />
          </Capsule>

          {/* Hand */}
          <Sphere args={sphereArgs(0.048)} position={[side * 0.425, 0.445, 0]}>
            <primitive object={mat} attach="material" />
          </Sphere>

          {/* Thigh */}
          <Capsule
            args={capsuleArgs(0.096, 0.36)}
            position={[side * 0.138, 0.13, 0]}
            rotation={[0, 0, side * 0.05]}
          >
            <primitive object={mat} attach="material" />
          </Capsule>

          {/* Calf */}
          <Capsule
            args={capsuleArgs(0.072, 0.34)}
            position={[side * 0.125, -0.45, 0]}
            rotation={[0, 0, side * 0.025]}
          >
            <primitive object={mat} attach="material" />
          </Capsule>

          {/* Foot */}
          <Capsule
            args={[0.044, 0.13, 16, 16]}
            position={[side * 0.122, -0.72, 0.06]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <primitive object={mat} attach="material" />
          </Capsule>
        </group>
      ))}
    </group>
  )
}

// ── Single injection zone marker ──────────────────────────────────────────────
interface ZoneMarkerProps {
  zone:        InjectionZone
  days:        number | undefined
  isRec:       boolean
  isSelected:  boolean
  onClick:     () => void
}

function ZoneMarker({ zone, days, isRec, isSelected, onClick }: ZoneMarkerProps) {
  const meshRef     = useRef<THREE.Mesh>(null)
  const glowRef     = useRef<THREE.Mesh>(null)
  const pulseRef    = useRef(0)
  const color       = statusColor(days)
  const threeColor  = useMemo(() => new THREE.Color(color), [color])

  useFrame((_, delta) => {
    if (!meshRef.current || !glowRef.current) return
    pulseRef.current += delta * (isRec ? 2.2 : 1.4)

    // Breathe scale
    const breath = isRec
      ? 1 + Math.sin(pulseRef.current) * 0.18
      : 1 + Math.sin(pulseRef.current) * 0.06

    meshRef.current.scale.setScalar(breath)

    // Glow opacity pulse
    const mat = glowRef.current.material as THREE.MeshBasicMaterial
    mat.opacity = isRec
      ? 0.18 + Math.sin(pulseRef.current) * 0.14
      : 0.08 + Math.sin(pulseRef.current * 0.8) * 0.04
  })

  return (
    <group position={zone.position as [number, number, number]}>
      {/* Outer glow halo */}
      <Sphere args={[0.052, 16, 16]} ref={glowRef}>
        <meshBasicMaterial
          color={threeColor}
          transparent
          opacity={0.12}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </Sphere>

      {/* Main zone sphere */}
      <Sphere
        ref={meshRef}
        args={[0.030, 24, 24]}
        onClick={e => { e.stopPropagation(); onClick() }}
      >
        <meshStandardMaterial
          color={threeColor}
          emissive={threeColor}
          emissiveIntensity={isSelected ? 1.8 : isRec ? 1.2 : 0.7}
          roughness={0.2}
          metalness={0.1}
          transparent
          opacity={days === undefined ? 0.55 : 1}
        />
      </Sphere>

      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.042, 0.050, 32]} />
          <meshBasicMaterial color={threeColor} transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

// ── Lights ────────────────────────────────────────────────────────────────────
function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.25} color="#1a2a4a" />
      {/* Key light — warm, top-front */}
      <directionalLight position={[1.5, 3, 2]} intensity={0.9} color="#c8d8f8" castShadow />
      {/* Rim light — cyan, back-right */}
      <directionalLight position={[-2, 1, -2]} intensity={0.5} color="#00ccf5" />
      {/* Fill light — soft bottom */}
      <directionalLight position={[0, -2, 1]} intensity={0.2} color="#0a1830" />
    </>
  )
}

// ── Auto-rotate when idle ─────────────────────────────────────────────────────
function AutoRotate({ active }: { active: boolean }) {
  const { scene } = useThree()
  useFrame((_, delta) => {
    if (!active) return
    scene.rotation.y += delta * 0.25
  })
  return null
}

// ── Main scene (exported as default for Canvas) ───────────────────────────────
interface SceneProps {
  zones:       InjectionZone[]
  days:        Record<string, number>
  recommended: string | null
  selected:    string | null
  onZoneClick: (key: string) => void
  autoRotate:  boolean
}

function Scene({ zones, days, recommended, selected, onZoneClick, autoRotate }: SceneProps) {
  return (
    <>
      <SceneLights />
      <AutoRotate active={autoRotate} />
      <group position={[0, -0.5, 0]}>
        <BodyMesh />
        {zones.map(zone => (
          <ZoneMarker
            key={zone.key}
            zone={zone}
            days={days[zone.key]}
            isRec={recommended === zone.key}
            isSelected={selected === zone.key}
            onClick={() => onZoneClick(zone.key)}
          />
        ))}
      </group>
    </>
  )
}

// ── Public Canvas wrapper ─────────────────────────────────────────────────────
export interface BodySceneProps extends SceneProps {
  height?: number
}

export function BodyScene({ height = 480, ...sceneProps }: BodySceneProps) {
  const [userInteracted, setUserInteracted] = useState(false)

  return (
    <div
      style={{ width: '100%', height, touchAction: 'none', cursor: 'grab' }}
      onPointerDown={() => setUserInteracted(true)}
    >
      <Canvas
        camera={{ position: [0, 0.3, 2.9], fov: 42 }}
        dpr={[1, Math.min(window.devicePixelRatio, 2)]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent' }}
        shadows={false}
        frameloop="always"
      >
        <Scene {...sceneProps} autoRotate={!userInteracted && sceneProps.autoRotate} />
        <OrbitControls
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={1.6}
          maxDistance={4.2}
          minPolarAngle={Math.PI * 0.12}
          maxPolarAngle={Math.PI * 0.88}
          rotateSpeed={0.7}
          zoomSpeed={0.8}
          touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
        />
      </Canvas>
    </div>
  )
}
