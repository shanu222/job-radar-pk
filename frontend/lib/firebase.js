// Firebase is used only for "Continue with Google". The ID token is verified by our backend.
//
// Popups must open synchronously inside the click, so the SDK is loaded in advance (preloadGoogle)
// and the click handler calls signInWithPopup without awaiting anything first. If the browser still
// blocks the popup (strict settings, in-app browsers, some mobiles) we fall back to a full-page redirect.
const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const googleEnabled = !!(cfg.apiKey && cfg.authDomain && cfg.projectId);

let mods = null;
let loading = null;

export function preloadGoogle() {
  if (!googleEnabled || mods || loading) return loading;
  loading = Promise.all([import('firebase/app'), import('firebase/auth')]).then(([app, auth]) => {
    const fbApp = app.getApps()[0] || app.initializeApp(cfg);
    const a = auth.getAuth(fbApp);
    const provider = new auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    mods = { auth, a, provider };
    // Warm up the sign-in iframe now (Firebase only does this itself on mobile/Safari), so that
    // after the click nothing slow happens before the popup opens and the browser doesn't block it.
    Promise.resolve(a._popupRedirectResolver?._initialize?.(a)).catch(() => {});
    return mods;
  });
  return loading;
}

const POPUP_BLOCKED = new Set(['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported']);
export const CANCELLED = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']);

/** Must be called directly from a click handler. Resolves to an ID token, or null when redirecting. */
export async function googleIdToken() {
  const m = mods || (await preloadGoogle());
  try {
    const result = await m.auth.signInWithPopup(m.a, m.provider);
    const token = await result.user.getIdToken();
    m.auth.signOut(m.a).catch(() => {}); // we keep our own session
    return token;
  } catch (e) {
    if (POPUP_BLOCKED.has(e?.code)) {
      sessionStorageSet('jr_google_redirect', '1');
      await m.auth.signInWithRedirect(m.a, m.provider); // page navigates away
      return null;
    }
    throw e;
  }
}

/** After a redirect sign-in, the login page calls this on load. */
export async function googleRedirectToken() {
  if (!googleEnabled || sessionStorageGet('jr_google_redirect') !== '1') return null;
  sessionStorageSet('jr_google_redirect', '');
  const m = await preloadGoogle();
  const result = await m.auth.getRedirectResult(m.a);
  if (!result?.user) return null;
  const token = await result.user.getIdToken();
  m.auth.signOut(m.a).catch(() => {});
  return token;
}

function sessionStorageGet(k) { try { return sessionStorage.getItem(k); } catch { return null; } }
function sessionStorageSet(k, v) { try { v ? sessionStorage.setItem(k, v) : sessionStorage.removeItem(k); } catch { /* ignore */ } }
