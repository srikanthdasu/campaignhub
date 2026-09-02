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

  // Temporary diagnostic aid: visiting any page with ?debugbg=1 outlines the background layer's
  // real boundary in solid lime. If a gap is visible outside the outline, it's not this
  // component's sizing at all — the outline itself would prove that in one screenshot instead of
  // guessing again. Remove once the reported gap is confirmed resolved.
  const debugOutline = typeof window !== 'undefined' && window.location.search.includes('debugbg=1');

  // If the WebGL context never reports back as created — a broken/unsupported environment,
  // rather than just a slow one — stop rendering it instead of leaving a dead canvas in the DOM.
  // Skipped in debug mode so the outline stays visible even if WebGL itself never comes up.
  useEffect(() => {
    if (!mounted || ready || debugOutline) return;
    const timer = setTimeout(() => setGaveUp(true), READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [mounted, ready, debugOutline]);

  if (!mounted || gaveUp) return null;

  return (
    // 100vw/100vh, not a JS-measured pixel value — every attempt to compute this in JavaScript
    // (window.innerHeight, window.visualViewport) ended up wrong for this user in a way that
    // never reproduced in testing. Viewport units are the browser's own native computation, the
    // exact same mechanism the rest of this page's CSS already relies on correctly — nothing
    // left for a JS timing race or a zoom-level quirk to get wrong.
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        // Always full-opacity regardless of WebGL readiness, so the outline itself is a reliable
        // ground truth of this element's real boundary — it must never be invisible on its own.
        outline: debugOutline ? '4px solid lime' : undefined,
        outlineOffset: debugOutline ? '-4px' : undefined,
      }}
    >
      <div className="h-full w-full transition-opacity duration-1000" style={{ opacity: ready ? 0.8 : 0 }}>
        <WebGLErrorBoundary>
          <ThreeBackgroundScene reduceMotion={reduceMotion} onReady={() => setReady(true)} />
        </WebGLErrorBoundary>
      </div>
    </div>
  );
}
