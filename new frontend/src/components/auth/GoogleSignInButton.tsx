"use client";

import { useEffect, useId, useRef } from "react";
import Script from "next/script";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/**
 * Renders Google's own "Sign in with Google" button via Google Identity
 * Services. The button posts an ID token credential to `onCredential`,
 * which the caller exchanges for a session at POST /api/auth/google.
 */
export function GoogleSignInButton({
  onCredential,
  disabled,
}: {
  onCredential: (credential: string) => void;
  disabled?: boolean;
}) {
  const containerId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    if (!CLIENT_ID || disabled) return;

    function render() {
      if (!window.google || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID as string,
        callback: (response) => onCredentialRef.current(response.credential),
      });
      containerRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(containerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: 360,
        text: "continue_with",
        shape: "pill",
      });
    }

    if (window.google) {
      render();
    } else {
      const id = window.setInterval(() => {
        if (window.google) {
          window.clearInterval(id);
          render();
        }
      }, 100);
      return () => window.clearInterval(id);
    }
  }, [disabled]);

  // NEXT_PUBLIC_GOOGLE_CLIENT_ID isn't set yet — show a disabled placeholder
  // instead of silently disappearing, so it's obvious setup is pending rather
  // than looking like a missing feature.
  if (!CLIENT_ID) {
    return (
      <button
        type="button"
        disabled
        title="Set NEXT_PUBLIC_GOOGLE_CLIENT_ID (and backend GOOGLE_CLIENT_ID) to enable"
        className="w-full h-11 rounded-full border border-gray-300 bg-gray-50 text-sm font-medium text-gray-400 flex items-center justify-center gap-2 cursor-not-allowed"
      >
        <GoogleGlyph />
        Continue with Google (not configured)
      </button>
    );
  }

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      <div id={containerId} ref={containerRef} className="flex justify-center" />
    </>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#9CA3AF" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9A8.78 8.78 0 0 0 17.64 9.2z" />
      <path fill="#9CA3AF" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26a5.4 5.4 0 0 1-8.1-2.84H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#9CA3AF" d="M3.96 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3-2.33z" />
      <path fill="#9CA3AF" d="M9 3.58a4.9 4.9 0 0 1 3.46 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3 2.33A5.4 5.4 0 0 1 9 3.58z" />
    </svg>
  );
}
