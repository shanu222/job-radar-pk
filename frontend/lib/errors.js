// Turn any error into a short message that's safe to show users. Technical details go to the console only.
const FIREBASE = {
  'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.',
  'auth/network-request-failed': 'No internet connection. Check your connection and try again.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/unauthorized-domain': 'Google sign-in isn’t available on this address yet. Please use email sign-in.',
  'auth/account-exists-with-different-credential': 'This email is already registered. Sign in with your email and password.',
  'auth/user-disabled': 'This Google account can’t be used to sign in.',
  'auth/internal-error': 'Google sign-in didn’t work. Please try again.',
};

export function friendlyError(e, fallback = 'Something went wrong. Please try again.') {
  if (!e) return fallback;
  if (typeof e === 'string') return e;
  if (process.env.NODE_ENV !== 'production') console.error(e);
  if (e.code && FIREBASE[e.code]) return FIREBASE[e.code];
  if (e.code?.startsWith?.('auth/')) return 'Google sign-in didn’t work. Please try again or use email sign-in.';
  if (e.name === 'TypeError' && /fetch|network|load failed/i.test(e.message)) return 'Can’t reach the server. Check your internet connection and try again.';
  // Messages written by our API are already user-facing; anything else is hidden
  if (e.userFacing && e.message) return e.message;
  return fallback;
}
