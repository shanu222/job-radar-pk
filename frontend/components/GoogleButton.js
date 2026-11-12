'use client';
// Google's official "Sign in with Google" button (Google Identity Services).
// Opens a small Google popup — or Chrome's built-in account chooser (FedCM) — and is never blocked,
// because the window is opened by Google's own button directly from the click.
import { useEffect, useRef, useState } from 'react';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
export const gisEnabled = !!CLIENT_ID;

let scriptPromise = null;
function loadScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { scriptPromise = null; reject(new Error('Google sign-in could not load')); };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

/**
 * onCredential(idToken) is called after the user picks an account.
 * mode: 'signin' | 'signup' (changes the button text); oneTap shows the account prompt on load.
 */
export default function GoogleButton({ onCredential, onError, mode = 'signin', oneTap = true, disabled, fallback = null }) {
  const box = useRef(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !box.current) return;
      const g = window.google.accounts.id;
      g.initialize({
        client_id: CLIENT_ID,
        callback: (resp) => resp?.credential && cb.current?.(resp.credential),
        ux_mode: 'popup',
        context: mode === 'signup' ? 'signup' : 'signin',
        auto_select: false,
        cancel_on_tap_outside: true,
        itp_support: true,
        use_fedcm_for_prompt: true,
        use_fedcm_for_button: true,
      });
      const width = Math.min(400, Math.max(240, Math.floor(box.current.getBoundingClientRect().width)));
      g.renderButton(box.current, {
        type: 'standard', theme: 'outline', size: 'large', shape: 'rectangular',
        text: mode === 'signup' ? 'signup_with' : 'continue_with', logo_alignment: 'center', width,
      });
      if (oneTap) g.prompt();
    }).catch((e) => { if (!cancelled) { setFailed(true); onError?.(e); } });
    return () => {
      cancelled = true;
      try { window.google?.accounts?.id?.cancel(); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, oneTap]);

  if (failed) return fallback; // e.g. Google's script blocked by an extension → show our own button
  return (
    <div className={`flex min-h-[44px] w-full justify-center ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
      <div ref={box} className="w-full max-w-[400px] [&>div]:!mx-auto" />
    </div>
  );
}
