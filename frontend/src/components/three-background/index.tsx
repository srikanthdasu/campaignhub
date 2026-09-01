'use client';

import { Component, ReactNode, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const ThreeBackgroundScene = dynamic(
  () => import('./scene').then((mod) => mod.ThreeBackgroundScene),
  { ssr: false },
);

const READY_TIMEOUT_MS = 4000;

// WebGL isn't guaranteed (old hardware, some VMs/browsers, disabled by policy) — this is a
// decorative background layer, not core functionality, so any failure here should silently
// fall back to the existing static CSS gradient on body rather than break the app.
class WebGLErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('ThreeBackground failed, falling back to the static gradient:', error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function useViewportSize() {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    function measure() {
      // visualViewport reflects the actually-visible area (accounts for on-screen keyboards,
      // mobile browser chrome show/hide) more reliably than window.innerHeight on some devices;
      // fall back to innerWidth/innerHeight where it's unavailable (older browsers).
      const vv = window.visualViewport;
      setSize({ width: vv?.width ?? window.innerWidth, height: vv?.height ?? window.innerHeight });
    }
    measure();
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, []);

  return size;
}

export function ThreeBackground() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [ready, setReady] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const viewport = useViewportSize();

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(query.matches);
    const listener = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  // If the WebGL context never reports back as created — a broken/unsupported environment,
  // rather than just a slow one — stop rendering it instead of leaving a dead canvas in the DOM.
  useEffect(() => {
    if (!viewport || ready) return;
    const timer = setTimeout(() => setGaveUp(true), READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [viewport, ready]);

  if (!viewport || gaveUp) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none transition-opacity duration-1000"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: `${viewport.width}px`,
        height: `${viewport.height}px`,
        zIndex: 0,
        opacity: ready ? 0.8 : 0,
        overflow: 'hidden',
      }}
    >
      <WebGLErrorBoundary>
        <ThreeBackgroundScene reduceMotion={reduceMotion} onReady={() => setReady(true)} />
      </WebGLErrorBoundary>
    </div>
  );
}
