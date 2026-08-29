'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial } from '@react-three/drei';
import { Suspense, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { Mesh } from 'three';
import { cn } from '@/lib/cn';

function RotatingBlob() {
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.08;
      meshRef.current.rotation.y += delta * 0.12;
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.7}>
      <mesh ref={meshRef} scale={1.7}>
        <icosahedronGeometry args={[1, 8]} />
        <MeshDistortMaterial
          color="#6c54eb"
          distort={0.35}
          speed={1.4}
          roughness={0.15}
          metalness={0.15}
        />
      </mesh>
    </Float>
  );
}

function useHasWebGL() {
  const [supported] = useState<boolean | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    } catch {
      return false;
    }
  });

  return supported;
}

function GradientFallback({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse-slow rounded-full bg-gradient-to-br from-accent-400 via-accent-600 to-accent-800 opacity-70 blur-2xl',
        className,
      )}
    />
  );
}

export function GradientMeshHero({ className }: { className?: string }) {
  const webglSupported = useHasWebGL();
  const prefersReducedMotion = useReducedMotion();

  if (webglSupported === false || prefersReducedMotion) {
    return <GradientFallback className={className} />;
  }

  return (
    <div className={className}>
      {webglSupported === null ? (
        <GradientFallback className="h-full w-full" />
      ) : (
        <Suspense fallback={<GradientFallback className="h-full w-full" />}>
          <Canvas
            dpr={[1, 1.5]}
            camera={{ position: [0, 0, 4], fov: 40 }}
            gl={{ antialias: true, alpha: true }}
          >
            <ambientLight intensity={0.9} />
            <directionalLight position={[3, 3, 3]} intensity={1.2} />
            <RotatingBlob />
          </Canvas>
        </Suspense>
      )}
    </div>
  );
}
