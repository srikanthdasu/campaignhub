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
      <mesh ref={meshRef} scale={1.15}>
        <icosahedronGeometry args={[1, 12]} />
        <MeshDistortMaterial
          color="#7c5cf0"
          distort={0.45}
          speed={1.7}
          roughness={0.5}
          metalness={0.1}
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
    <div className={cn('relative', className)}>
      <div className="animate-pulse-slow absolute inset-0 rounded-full bg-gradient-to-br from-accent-400 via-accent-600 to-accent-800 opacity-80 blur-2xl" />
      <div
        className="absolute inset-[15%] rounded-full opacity-90 blur-md"
        style={{
          background:
            'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.55), rgba(255,255,255,0) 45%)',
        }}
      />
    </div>
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
            camera={{ position: [0, 0, 5], fov: 40 }}
            gl={{ antialias: true, alpha: true }}
          >
            <ambientLight intensity={0.4} />
            <directionalLight position={[3, 3, 3]} intensity={0.7} />
            <pointLight position={[-3, -2, 2.5]} intensity={2.2} color="#c4b5fd" />
            <pointLight position={[2.5, -3, -1]} intensity={1.4} color="#5b8dff" />
            <RotatingBlob />
          </Canvas>
        </Suspense>
      )}
    </div>
  );
}
