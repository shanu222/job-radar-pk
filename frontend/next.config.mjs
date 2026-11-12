/** @type {import('next').NextConfig} */
const firebaseProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Lets Google sign-in run on our own domain (set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN to this site's domain).
  // Avoids browsers blocking the sign-in because of third-party storage rules.
  async rewrites() {
    if (!firebaseProject) return [];
    return [{ source: '/__/auth/:path*', destination: `https://${firebaseProject}.firebaseapp.com/__/auth/:path*` }];
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        // Google sign-in popups need to talk back to this window
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
      ],
    }];
  },
};
export default nextConfig;
