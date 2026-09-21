'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: { theme: string; size: string; width: string | number; text: string },
          ) => void;
        };
      };
    };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export function GoogleSignInButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  function renderButton() {
    if (!CLIENT_ID || !window.google || !containerRef.current) return;
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (response) => onCredential(response.credential),
    });
    // GIS's `width` wants a pixel number, not a CSS percentage — measure the container (it
    // already fills its parent via the wrapping div below) so the button matches the card width.
    const width = containerRef.current.offsetWidth || 320;
    window.google.accounts.id.renderButton(containerRef.current, {
      theme: 'filled_black',
      size: 'large',
      width,
      text: 'continue_with',
    });
  }

  useEffect(() => {
    renderButton();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!CLIENT_ID) return null;

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={renderButton} />
      <div ref={containerRef} className="flex justify-center" />
    </>
  );
}
