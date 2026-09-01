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

export function ThreeBackground() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    setMounted(true);
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(query.matches);
    const listener = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  // If the WebGL context never reports back as created — a broken/unsupported environment,
  // rather than just a slow one — stop rendering it instead of leaving a dead canvas in the DOM.
  useEffect(() => {
    if (!mounted || ready) return;
    const timer = setTimeout(() => setGaveUp(true), READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [mounted, ready]);

  if (!mounted || gaveUp) return null;

  return (
    // 100vw/100vh, not a JS-measured pixel value — every attempt to compute this in JavaScript
    // (window.innerHeight, window.visualViewport) ended up wrong for this user in a way that
    // never reproduced in testing. Viewport units are the browser's own native computation, the
    // exact same mechanism the rest of this page's CSS already relies on correctly — nothing
    // left for a JS timing race or a zoom-level quirk to get wrong.
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-1000"
      style={{ width: '100vw', height: '100vh', opacity: ready ? 0.8 : 0, overflow: 'hidden' }}
    >
      <WebGLErrorBoundary>
        <ThreeBackgroundScene reduceMotion={reduceMotion} onReady={() => setReady(true)} />
      </WebGLErrorBoundary>
    </div>
  );
}
