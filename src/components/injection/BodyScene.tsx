import { useRef, useState, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { InjectionZone } from '../../pages/InjectionTracker3D'

// ── Zone status colors ────────────────────────────────────────────────────────
function zoneColor(days: number | undefined): THREE.Color {
  if (days === undefined) return new THREE.Color('#00ff88')
  if (days === 0)  return new THREE.Color('#ff2244')
  if (days === 1)  return new THREE.Color('#ff6600')
  if (days <= 3)   return new THREE.Color('#ffcc00')
  if (days <= 5)   return new THREE.Color('#00ddaa')
  return new THREE.Color('#00ff88')
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
  uniform vec3  uInner;
  uniform vec3  uEdge;
  uniform vec3  uAccent;
  uniform float uPower;
  uniform float uTime;

  void main() {
    float ndv     = max(dot(vNormal, vViewDir), 0.0);
    float fresnel = pow(1.0 - ndv, uPower);
    float pulse   = 1.0 + sin(uTime * 1.4) * 0.05;
    fresnel *= pulse;

    vec3  keyDir = normalize(vec3(0.2, 1.2, 0.6));
    float diff   = max(dot(vNormal, keyDir), 0.0);

    // subtle scan lines
    float scan = sin(vWorldPos.y * 32.0 + uTime * 0.4) * 0.5 + 0.5;
    scan = pow(scan, 14.0) * 0.15;

    vec3 core  = uInner + uEdge * diff * 0.15;
    vec3 edge  = mix(uEdge, uAccent, fresnel * 0.55);
    vec3 color = mix(core, edge, fresnel) + uEdge * scan;
    float alpha = mix(0.32, 1.0, fresnel) + diff * 0.08 + scan * 0.4;

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`

function makeHoloMat() {
  return new THREE.ShaderMaterial({
    vertexShader:   holoVert,
    fragmentShader: holoFrag,
    uniforms: {
      uInner:  { value: new THREE.Color('#000d1f') },
      uEdge:   { value: new THREE.Color('#0055ee') },
      uAccent: { value: new THREE.Color('#33bbff') },
      uPower:  { value: 2.0 },
      uTime:   { value: 0 },
    },
    transparent: true,
    depthWrite:  false,
    side:        THREE.FrontSide,
  })
}

// ── Real body from GLB ────────────────────────────────────────────────────────
// Drop any GLB into public/models/body.glb — applies holographic shader automatically
function RealBody({ mat }: { mat: THREE.ShaderMaterial }) {
  const { scene } = useGLTF('/models/body.glb')
  const cloned = useMemo(() => {
    const c = scene.clone(true)
    c.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = mat
        child.castShadow = false
        child.receiveShadow = false
      }
    })
    return c
  }, [scene, mat])

  return <primitive object={cloned} />
}

// ── Fallback procedural body (if no GLB provided) ─────────────────────────────
// Uses LatheGeometry for torso/head + Capsules for limbs — better than stacked pills
function FallbackBody({ mat }: { mat: THREE.ShaderMaterial }) {
  // Torso profile (r at each height) — LatheGeometry
  const torsoGeo = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.00, -0.50),  // base
      new THREE.Vector2(0.19, -0.45),  // hips wide
      new THREE.Vector2(0.18, -0.30),  // hip mid
      new THREE.Vector2(0.14, -0.10),  // waist narrow
      new THREE.Vector2(0.18,  0.10),  // lower chest
      new THREE.Vector2(0.20,  0.30),  // chest
      new THREE.Vector2(0.19,  0.45),  // upper chest
      new THREE.Vector2(0.14,  0.52),  // shoulders taper
      new THREE.Vector2(0.00,  0.56),  // top
    ]
    return new THREE.LatheGeometry(pts, 48)
  }, [])

  // Head profile
  const headGeo = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.00,  0.00),
      new THREE.Vector2(0.07,  0.02),
      new THREE.Vector2(0.12,  0.08),
      new THREE.Vector2(0.13,  0.16),
      new THREE.Vector2(0.12,  0.24),
      new THREE.Vector2(0.09,  0.30),
      new THREE.Vector2(0.05,  0.34),
      new THREE.Vector2(0.00,  0.36),
    ]
    return new THREE.LatheGeometry(pts, 48)
  }, [])

  // Arm profile
  const armGeo = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.00,  0.00),
      new THREE.Vector2(0.06,  0.02),
      new THREE.Vector2(0.07,  0.12),
      new THREE.Vector2(0.065, 0.28),
      new THREE.Vector2(0.055, 0.44),
      new THREE.Vector2(0.045, 0.56),
      new THREE.Vector2(0.038, 0.64),
      new THREE.Vector2(0.00,  0.66),
    ]
    return new THREE.LatheGeometry(pts, 32)
  }, [])

  // Leg profile
  const legGeo = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.00,  0.00),
      new THREE.Vector2(0.045, 0.04),
      new THREE.Vector2(0.095, 0.10),
      new THREE.Vector2(0.095, 0.28),
      new THREE.Vector2(0.080, 0.38),
      new THREE.Vector2(0.072, 0.46),
      new THREE.Vector2(0.068, 0.62),
      new THREE.Vector2(0.055, 0.72),
      new THREE.Vector2(0.048, 0.82),
      new THREE.Vector2(0.00,  0.85),
    ]
    return new THREE.LatheGeometry(pts, 32)
  }, [])

  return (
    <group>
      {/* Head */}
      <mesh geometry={headGeo} material={mat} position={[0, 1.46, 0]} />
      {/* Neck connector */}
      <mesh geometry={new THREE.CylinderGeometry(0.052, 0.062, 0.10, 24)}
        material={mat} position={[0, 1.42, 0]} />
      {/* Torso */}
      <mesh geometry={torsoGeo} material={mat} position={[0, 0.60, 0]} />

      {/* Arms — rotated so they hang down */}
      {([-1, 1] as const).map(side => (
        <group key={side}>
          <mesh geometry={armGeo} material={mat}
            position={[side * 0.31, 1.04, 0]}
            rotation={[0, 0, side * (Math.PI - 0.14)]}
            scale={[1, 1, 1]}
          />
          {/* Legs */}
          <mesh geometry={legGeo} material={mat}
            position={[side * 0.14, 0.10, 0]}
            rotation={[0, 0, side * 0.04]}
            scale={[1, -1, 1]}
          />
        </group>
      ))}
    </group>
  )
}

function BodyLoader({ mat }: { mat: THREE.ShaderMaterial }) {
  // Try real model first, fall back to procedural
  try {
    return (
      <Suspense fallback={<FallbackBody mat={mat} />}>
        <RealBody mat={mat} />
      </Suspense>
    )
  } catch {
    return <FallbackBody mat={mat} />
  }
}

// ── Injection zone marker ─────────────────────────────────────────────────────
// Very small crosshair / pulse dot — does not dominate the body
interface ZoneMarkerProps {
  zone: InjectionZone; days: number | undefined
  isRec: boolean; isSelected: boolean; onClick: () => void
}

function ZoneMarker({ zone, days, isRec, isSelected, onClick }: ZoneMarkerProps) {
  const t     = useRef(0)
  const ring1 = useRef<THREE.Mesh>(null)
  const ring2 = useRef<THREE.Mesh>(null)
  const dot   = useRef<THREE.Mesh>(null)
  const col   = useMemo(() => zoneColor(days), [days])

  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: col, transparent: true, opacity: 0.90,
    depthWrite: false, side: THREE.DoubleSide,
  }), [col])

  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: col, transparent: true, opacity: 0.20,
    depthWrite: false, side: THREE.BackSide,
  }), [col])

  const dotMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: col, transparent: true, opacity: 1.0, depthWrite: false,
  }), [col])

  useFrame((state, delta) => {
    t.current += delta
    const spd = isRec ? 2.8 : 1.6

    if (ring1.current) {
      const s = 1 + Math.sin(t.current * spd) * (isRec ? 0.25 : 0.10)
      ring1.current.scale.setScalar(s)
    }
    if (ring2.current && isRec) {
      const s = 1 + Math.sin(t.current * spd + 1.0) * 0.18
      ring2.current.scale.setScalar(s)
    }
    if (dot.current) {
      ;(dot.current.material as THREE.MeshBasicMaterial).opacity =
        0.9 + Math.sin(t.current * spd) * 0.10
    }

    // Billboard — always face camera
    if (ring1.current)
      ring1.current.quaternion.copy(state.camera.quaternion)
    if (ring2.current)
      ring2.current.quaternion.copy(state.camera.quaternion)
    if (dot.current)
      dot.current.quaternion.copy(state.camera.quaternion)
  })

  // Tiny sizes: ring 0.018, dot 0.006, glow 0.028
  const R  = 0.018
  const R2 = 0.025
  const D  = 0.006

  return (
    <group position={zone.position as [number, number, number]}>
      {/* Outer soft glow sphere */}
      <mesh>
        <sphereGeometry args={[0.030, 12, 12]} />
        <primitive object={glowMat} attach="material" />
      </mesh>

      {/* Main ring */}
      <mesh ref={ring1} onClick={e => { e.stopPropagation(); onClick() }}>
        <ringGeometry args={[R * 0.65, R, 32]} />
        <primitive object={ringMat} attach="material" />
      </mesh>

      {/* Second ring for recommended */}
      {isRec && (
        <mesh ref={ring2}>
          <ringGeometry args={[R2 * 0.68, R2, 32]} />
          <primitive object={ringMat} attach="material" />
        </mesh>
      )}

      {/* Centre dot */}
      <mesh ref={dot} onClick={e => { e.stopPropagation(); onClick() }}>
        <circleGeometry args={[D, 16]} />
        <primitive object={dotMat} attach="material" />
      </mesh>

      {/* Selection highlight */}
      {isSelected && (
        <mesh>
          <ringGeometry args={[R2 * 0.8, R2 * 1.0, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.95}
            depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

// ── Scene clock + auto-rotate ──────────────────────────────────────────────────
function SceneTick({ mat, touched }: { mat: THREE.ShaderMaterial; touched: boolean }) {
  const t = useRef(0)
  useFrame((state, delta) => {
    t.current += delta
    mat.uniforms.uTime.value = t.current
    if (!touched) state.scene.rotation.y += delta * 0.20
  })
  return null
}

// ── Public Canvas ─────────────────────────────────────────────────────────────
export interface BodySceneProps {
  zones: InjectionZone[]; days: Record<string, number>
  recommended: string | null; selected: string | null
  onZoneClick: (key: string) => void
  autoRotate: boolean; height?: number
}

export function BodyScene({ zones, days, recommended, selected, onZoneClick, autoRotate, height = 480 }: BodySceneProps) {
  const [touched, setTouched] = useState(false)
  const mat = useMemo(() => makeHoloMat(), [])

  return (
    <div style={{ width: '100%', height, touchAction: 'none', cursor: 'grab' }}
      onPointerDown={() => setTouched(true)}>
      <Canvas
        camera={{ position: [0, 0.35, 3.0], fov: 40 }}
        dpr={[1, Math.min(window.devicePixelRatio, 2)]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        frameloop="always"
      >
        <color attach="background" args={['#020810']} />
        <SceneTick mat={mat} touched={!autoRotate || touched} />

        <group position={[0, -0.5, 0]}>
          <BodyLoader mat={mat} />
          {zones.map(z => (
            <ZoneMarker key={z.key} zone={z}
              days={days[z.key]}
              isRec={recommended === z.key}
              isSelected={selected === z.key}
              onClick={() => onZoneClick(z.key)}
            />
          ))}
        </group>

        <OrbitControls enablePan={false} enableDamping dampingFactor={0.07}
          minDistance={1.5} maxDistance={4.5}
          minPolarAngle={Math.PI * 0.08} maxPolarAngle={Math.PI * 0.92}
          rotateSpeed={0.65} zoomSpeed={0.75}
          touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
        />
      </Canvas>
    </div>
  )
}
