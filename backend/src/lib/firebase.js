// Google sign-in verification. Accepts either:
//  • a Google ID token from the "Sign in with Google" button (Google Identity Services) — needs GOOGLE_CLIENT_ID
//  • a Firebase Authentication ID token (older popup flow) — needs FIREBASE_PROJECT_ID
// Both are verified locally with Google's public keys. Returns a normalized identity whose `sub` is the
// user's Google account ID in both cases, so the same person always maps to the same JobRadar account.
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';

const FIREBASE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

const clientIds = () => String(process.env.GOOGLE_CLIENT_ID || '').split(',').map((s) => s.trim()).filter(Boolean);
export const firebaseEnabled = () => !!process.env.FIREBASE_PROJECT_ID || clientIds().length > 0;

export async function verifyGoogleSignIn(idToken) {
  if (typeof idToken !== 'string' || idToken.length > 4096) throw new Error('Invalid token');
  let iss;
  try { iss = decodeJwt(idToken).iss; } catch { throw new Error('Invalid token'); }

  if (iss === 'https://accounts.google.com' || iss === 'accounts.google.com') {
    if (!clientIds().length) throw new Error('GOOGLE_CLIENT_ID not configured');
    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, { issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: clientIds(), algorithms: ['RS256'] });
    return { sub: String(payload.sub), email: payload.email, email_verified: payload.email_verified === true, name: payload.name };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID not configured');
  const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, { issuer: `https://securetoken.google.com/${projectId}`, audience: projectId, algorithms: ['RS256'] });
  if (payload.auth_time && payload.auth_time * 1000 > Date.now() + 60_000) throw new Error('Invalid token');
  const googleSub = payload.firebase?.identities?.['google.com']?.[0];
  return { sub: String(googleSub || payload.sub), email: payload.email, email_verified: payload.email_verified === true, name: payload.name };
}
