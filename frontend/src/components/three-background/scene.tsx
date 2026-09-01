'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// R3F normally sizes the canvas via a ResizeObserver on its parent. Some embedded/CDP-driven
// browser contexts never fire that observer at all (confirmed directly — a bare ResizeObserver
// on a freshly-observed element never called back), which leaves the canvas stuck at the
// default 300x150. A single mount-time gl.setSize() call isn't reliable either — if it runs
// before the page's layout has fully settled (web fonts swapping in, a scrollbar appearing,
// anything that reflows height without firing a window "resize" event), it locks in a too-short
// measurement forever, leaving a visible gap below the canvas. Comparing against the live window
// size every frame and correcting on drift is self-healing regardless of what caused the mismatch
// or when — the check is just two integer comparisons, negligible next to the rest of the frame.
function ManualResizer() {
  const { gl, camera, size } = useThree();

  function applySize(width: number, height: number) {
    gl.setSize(width, height, true);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  }

  useEffect(() => {
    applySize(window.innerWidth, window.innerHeight);
    function onResize() {
      applySize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera]);

  useFrame(() => {
    const { innerWidth, innerHeight } = window;
    if (size.width !== innerWidth || size.height !== innerHeight) {
      applySize(innerWidth, innerHeight);
    }
  });

  return null;
}

// Matches the app's actual palette (globals.css --color-accent-*, and the fuchsia used in
// gradient-text/button gradients) — this replaces the static CSS radial-gradient blobs on body
// with the same colors, alive instead of painted on.
const ACCENT = new THREE.Color('#6c7bff');
const ACCENT_DEEP = new THREE.Color('#5b63f5');
const FUCHSIA = new THREE.Color('#e879f9');

const PARTICLE_COUNT = 700;

function softCircleTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function ParticleField({ reduceMotion }: { reduceMotion: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const texture = useMemo(() => softCircleTexture(), []);

  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const palette = [ACCENT, ACCENT_DEEP, FUCHSIA];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const radius = 8 + Math.random() * 14;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.6;
      positions[i * 3 + 2] = radius * Math.cos(phi) - 6;

      const color = palette[i % palette.length];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = 0.06 + Math.random() * 0.14;
    }
    return { positions, colors, sizes };
  }, []);

  useFrame((state, delta) => {
    if (!pointsRef.current || reduceMotion) return;
    pointsRef.current.rotation.y += delta * 0.02;
    pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.08;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.35}
        map={texture}
        vertexColors
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

function DriftingOrb({
  position,
  scale,
  color,
  speed,
  reduceMotion,
}: {
  position: [number, number, number];
  scale: number;
  color: THREE.Color;
  speed: number;
  reduceMotion: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const basePosition = useRef(position);

  useFrame((state) => {
    if (!meshRef.current || reduceMotion) return;
    const t = state.clock.elapsedTime * speed;
    meshRef.current.position.x = basePosition.current[0] + Math.sin(t) * 1.2;
    meshRef.current.position.y = basePosition.current[1] + Math.cos(t * 0.8) * 0.8;
  });

  return (
    <mesh ref={meshRef} position={position} scale={scale}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial color={color} transparent opacity={0.06} wireframe />
    </mesh>
  );
}

export function ThreeBackgroundScene({
  reduceMotion,
  onReady,
}: {
  reduceMotion: boolean;
  onReady: () => void;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 12], fov: 55 }}
      dpr={[1, 1.5]}
      gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
      onCreated={onReady}
    >
      <ManualResizer />
      <ParticleField reduceMotion={reduceMotion} />
      <DriftingOrb position={[-6, 3, -8]} scale={3.2} color={ACCENT_DEEP} speed={0.15} reduceMotion={reduceMotion} />
      <DriftingOrb position={[7, -2, -10]} scale={2.6} color={FUCHSIA} speed={0.12} reduceMotion={reduceMotion} />
    </Canvas>
  );
}
