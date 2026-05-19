import { useRef, useState, useMemo, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Capsule, Sphere } from '@react-three/drei'
import * as THREE from 'three'
import type { InjectionZone } from '../../pages/InjectionTracker3D'

// ── Zone status colors ────────────────────────────────────────────────────────
function zoneColor(days: number | undefined): THREE.Color {
  if (days === undefined) return new THREE.Color('#00ff88')  // free  – bright green
  if (days === 0)  return new THREE.Color('#ff2244')         // today – red
  if (days === 1)  return new THREE.Color('#ff6600')         // yesterday – orange
  if (days <= 3)   return new THREE.Color('#ffcc00')         // caution – amber
  if (days <= 5)   return new THREE.Color('#00ddaa')         // ok – teal
  return                 new THREE.Color('#00ff88')           // free – bright green
}

// ── Holographic Fresnel shader ────────────────────────────────────────────────
const holoVert = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec4 mvPos    = viewMatrix * worldPos;
    vWorldPos     = worldPos.xyz;
    vNormal       = normalize(normalMatrix * normal);
    vViewDir      = normalize(-mvPos.xyz);
    gl_Position   = projectionMatrix * mvPos;
  }
`

const holoFrag = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;

  uniform vec3  uInner;       // very dark core
  uniform vec3  uEdge;        // bright edge glow
  uniform vec3  uAccent;      // brightest highlight
  uniform float uPower;       // fresnel sharpness
  uniform float uTime;

  void main() {
    // Fresnel — strongest at silhouette edges
    float ndv     = max(dot(vNormal, vViewDir), 0.0);
    float fresnel = pow(1.0 - ndv, uPower);

    // Subtle breathing pulse on edges
    float pulse = 1.0 + sin(uTime * 1.4) * 0.06;
    fresnel *= pulse;

    // Top-light diffuse (gives body form/structure)
    vec3  keyDir = normalize(vec3(0.2, 1.2, 0.6));
    float diff   = max(dot(vNormal, keyDir), 0.0);

    // Scan line effect (thin horizontal bands — subtle)
    float scan = sin(vWorldPos.y * 28.0 + uTime * 0.5) * 0.5 + 0.5;
    scan = pow(scan, 12.0) * 0.18;

    // Assemble color
    vec3 coreColor = uInner + uEdge * diff * 0.18;
    vec3 edgeColor = mix(uEdge, uAccent, fresnel * 0.6);
    vec3 color     = mix(coreColor, edgeColor, fresnel) + uEdge * scan;

    // Alpha — opaque at edges, translucent at core
    float alpha = mix(0.38, 1.0, fresnel) + diff * 0.10 + scan * 0.5;

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`

// Shared holographic material (one instance for the whole body)
function useHoloMat() {
  const ref = useRef(0)
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   holoVert,
    fragmentShader: holoFrag,
    uniforms: {
      uInner:  { value: new THREE.Color('#000d1a') },  // near-black interior
      uEdge:   { value: new THREE.Color('#0066ff') },  // electric blue
      uAccent: { value: new THREE.Color('#44ccff') },  // bright cyan highlight
      uPower:  { value: 2.2 },
      uTime:   { value: 0 },
    },
    transparent: true,
    depthWrite:  false,
    side:        THREE.FrontSide,
  }), [])

  // Animate shader time uniform
  useFrame((_, delta) => {
    ref.current += delta
    mat.uniforms.uTime.value = ref.current
  })

  return mat
}

// ── Procedural body ───────────────────────────────────────────────────────────
const SEG = 36

function BodyMesh() {
  const mat = useHoloMat()
  const c = useCallback((r: number, l: number): [number, number, number, number] =>
    [r, l, SEG, SEG], [])
  const s = useCallback((r: number): [number, number, number] => [r, SEG, SEG], [])

  return (
    <group>
      {/* Head */}
      <Sphere args={s(0.138)} position={[0, 1.63, 0]}>
        <primitive object={mat} attach="material" />
      </Sphere>
      {/* Neck */}
      <Capsule args={c(0.054, 0.10)} position={[0, 1.478, 0]}>
        <primitive object={mat} attach="material" />
      </Capsule>
      {/* Upper chest */}
      <Capsule args={c(0.198, 0.40)} position={[0, 1.185, 0]}>
        <primitive object={mat} attach="material" />
      </Capsule>
      {/* Mid torso */}
      <Capsule args={c(0.168, 0.28)} position={[0, 0.795, 0]}>
        <primitive object={mat} attach="material" />
      </Capsule>
      {/* Pelvis */}
      <Capsule args={c(0.192, 0.12)} position={[0, 0.505, 0]}>
        <primitive object={mat} attach="material" />
      </Capsule>

      {/* Limbs — mirrored left/right */}
      {([-1, 1] as const).map(s => (
        <group key={s}>
          {/* Shoulder */}
          <Sphere args={[0.084, SEG, SEG]} position={[s * 0.288, 1.308, 0]}>
            <primitive object={mat} attach="material" />
          </Sphere>
          {/* Upper arm */}
          <Capsule args={c(0.067, 0.30)} position={[s * 0.368, 1.048, 0]}
            rotation={[0, 0, s * -0.15]}>
            <primitive object={mat} attach="material" />
          </Capsule>
          {/* Forearm */}
          <Capsule args={c(0.053, 0.28)} position={[s * 0.408, 0.688, 0]}
            rotation={[0, 0, s * -0.08]}>
            <primitive object={mat} attach="material" />
          </Capsule>
          {/* Hand */}
          <Sphere args={[0.048, SEG, SEG]} position={[s * 0.428, 0.448, 0]}>
            <primitive object={mat} attach="material" />
          </Sphere>
          {/* Thigh */}
          <Capsule args={c(0.098, 0.37)} position={[s * 0.140, 0.132, 0]}
            rotation={[0, 0, s * 0.055]}>
            <primitive object={mat} attach="material" />
          </Capsule>
          {/* Knee */}
          <Sphere args={[0.068, SEG, SEG]} position={[s * 0.132, -0.24, 0]}>
            <primitive object={mat} attach="material" />
          </Sphere>
          {/* Calf */}
          <Capsule args={c(0.073, 0.35)} position={[s * 0.126, -0.458, 0]}
            rotation={[0, 0, s * 0.028]}>
            <primitive object={mat} attach="material" />
          </Capsule>
          {/* Foot */}
          <Capsule args={[0.045, 0.14, SEG, SEG]}
            position={[s * 0.124, -0.728, 0.064]}
            rotation={[Math.PI / 2, 0, 0]}>
            <primitive object={mat} attach="material" />
          </Capsule>
        </group>
      ))}
    </group>
  )
}

// ── Injection zone marker (scan-target style) ─────────────────────────────────
interface ZoneMarkerProps {
  zone:       InjectionZone
  days:       number | undefined
  isRec:      boolean
  isSelected: boolean
  onClick:    () => void
}

function ZoneMarker({ zone, days, isRec, isSelected, onClick }: ZoneMarkerProps) {
  const outerRef  = useRef<THREE.Mesh>(null)
  const innerRef  = useRef<THREE.Mesh>(null)
  const glowRef   = useRef<THREE.Mesh>(null)
  const t         = useRef(0)
  const col       = useMemo(() => zoneColor(days), [days])

  const outerMat  = useMemo(() => new THREE.MeshBasicMaterial({
    color: col, transparent: true, opacity: 0.85,
    depthWrite: false, side: THREE.DoubleSide,
  }), [col])

  const innerMat  = useMemo(() => new THREE.MeshBasicMaterial({
    color: col, transparent: true, opacity: 0.9, depthWrite: false,
  }), [col])

  const glowMat   = useMemo(() => new THREE.MeshBasicMaterial({
    color: col, transparent: true, opacity: 0.18,
    depthWrite: false, side: THREE.BackSide,
  }), [col])

  useFrame((_, delta) => {
    t.current += delta
    const spd = isRec ? 3.0 : 1.8
    const s   = 1 + Math.sin(t.current * spd) * (isRec ? 0.22 : 0.08)

    if (outerRef.current)  outerRef.current.scale.setScalar(s)
    if (glowRef.current)   glowRef.current.scale.setScalar(1.5 + Math.sin(t.current * spd * 0.6) * 0.3)
    if (innerRef.current && isRec)
      (innerRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.85 + Math.sin(t.current * spd) * 0.15

    // Billboard outer ring to face camera
    if (outerRef.current) {
      // rings always face up — keep them flat (XZ plane)
    }
  })

  return (
    <group position={zone.position as [number, number, number]}>
      {/* Soft outer halo */}
      <Sphere args={[0.060, 16, 16]} ref={glowRef}>
        <primitive object={glowMat} attach="material" />
      </Sphere>

      {/* Outer scan ring */}
      <mesh ref={outerRef} rotation={[Math.PI / 2, 0, 0]} onClick={e => { e.stopPropagation(); onClick() }}>
        <ringGeometry args={[0.026, 0.034, 32]} />
        <primitive object={outerMat} attach="material" />
      </mesh>

      {/* Cross hairs */}
      {isRec && (
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.038, 0.042, 32]} />
            <primitive object={outerMat} attach="material" />
          </mesh>
        </>
      )}

      {/* Centre dot */}
      <Sphere args={[0.012, 12, 12]} ref={innerRef}
        onClick={e => { e.stopPropagation(); onClick() }}>
        <primitive object={innerMat} attach="material" />
      </Sphere>

      {/* Selection flash ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.048, 0.056, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

// ── Scene lighting ────────────────────────────────────────────────────────────
function Lights() {
  return (
    <>
      {/* Very dim ambient — body shader handles its own lighting */}
      <ambientLight intensity={0.04} color="#001030" />
      {/* Subtle top fill to help with depth */}
      <directionalLight position={[0, 4, 2]} intensity={0.12} color="#2244aa" />
      {/* Back rim — adds separation from background */}
      <directionalLight position={[0, 0, -3]} intensity={0.08} color="#003388" />
    </>
  )
}

// ── Auto-rotate until first touch ─────────────────────────────────────────────
function AutoRotate({ on }: { on: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((state, delta) => {
    if (!on) return
    state.scene.rotation.y += delta * 0.22
  })
  return <group ref={groupRef} />
}

// ── Public interface ──────────────────────────────────────────────────────────
export interface BodySceneProps {
  zones:       InjectionZone[]
  days:        Record<string, number>
  recommended: string | null
  selected:    string | null
  onZoneClick: (key: string) => void
  autoRotate:  boolean
  height?:     number
}

export function BodyScene({ zones, days, recommended, selected, onZoneClick, autoRotate, height = 480 }: BodySceneProps) {
  const [touched, setTouched] = useState(false)

  return (
    <div
      style={{ width: '100%', height, touchAction: 'none', cursor: 'grab' }}
      onPointerDown={() => setTouched(true)}
    >
      <Canvas
        camera={{ position: [0, 0.35, 3.0], fov: 40 }}
        dpr={[1, Math.min(window.devicePixelRatio, 2)]}
        gl={{
          antialias:       true,
          alpha:           false,
          powerPreference: 'high-performance',
        }}
        style={{ background: '#020712' }}
        frameloop="always"
      >
        <color attach="background" args={['#020712']} />

        <Lights />
        <AutoRotate on={autoRotate && !touched} />

        <group position={[0, -0.5, 0]}>
          <BodyMesh />
          {zones.map(z => (
            <ZoneMarker
              key={z.key}
              zone={z}
              days={days[z.key]}
              isRec={recommended === z.key}
              isSelected={selected === z.key}
              onClick={() => onZoneClick(z.key)}
            />
          ))}
        </group>

        <OrbitControls
          enablePan={false}
          enableDamping
          dampingFactor={0.07}
          minDistance={1.5}
          maxDistance={4.5}
          minPolarAngle={Math.PI * 0.08}
          maxPolarAngle={Math.PI * 0.92}
          rotateSpeed={0.65}
          zoomSpeed={0.75}
          touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
        />
      </Canvas>
    </div>
  )
}
