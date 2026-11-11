// Verifies Firebase Authentication ID tokens (Google sign-in) using Google's public keys.
// Only FIREBASE_PROJECT_ID is needed — no service-account file.
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export const firebaseEnabled = () => !!process.env.FIREBASE_PROJECT_ID;

export async function verifyFirebaseIdToken(idToken) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Google sign-in is not configured on the server');
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    algorithms: ['RS256'],
  });
  if (!payload.sub || typeof payload.sub !== 'string') throw new Error('Invalid Google token');
  if (payload.auth_time && payload.auth_time * 1000 > Date.now() + 60_000) throw new Error('Invalid Google token');
  return payload; // { sub, email, email_verified, name, picture, firebase: { sign_in_provider } }
}
