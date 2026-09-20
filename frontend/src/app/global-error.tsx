'use client';

import { useEffect } from 'react';

// Catches errors in the root layout itself (e.g. AuthProvider, the decorative background) — the
// one boundary that can't reuse the app's own components, since those depend on the very
// providers this exists to catch failures in. Must render its own <html>/<body>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0c0e13',
          color: '#e7e9ee',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div style={{ maxWidth: 360, textAlign: 'center', padding: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px' }}>Something went wrong</h2>
          <p style={{ fontSize: 14, color: '#a3aab8', margin: '0 0 20px' }}>
            CampaignHub AI hit an unexpected error loading. Reloading usually fixes this.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '10px 20px',
              borderRadius: 12,
              border: 'none',
              background: '#5b63f5',
              color: 'white',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
