'use client';
// The whole platform is for signed-in users. Visitors only see the sign-in / sign-up pages;
// any other page sends them to sign in and brings them back afterwards.
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from './AuthProvider';

const PUBLIC = ['/', '/login', '/register'];

export default function AuthGate({ children }) {
  const { user, ready } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC.includes(path);

  useEffect(() => {
    if (!ready) return;
    if (!user && !isPublic) {
      const here = `${path}${typeof window !== 'undefined' ? window.location.search : ''}`;
      router.replace(`/login?next=${encodeURIComponent(here)}`);
    } else if (user && isPublic) {
      // Signed in on the sign-in page: go back to the page they were trying to open
      const n = new URLSearchParams(window.location.search).get('next') || '';
      const safe = /^\/(?!\/)[^\s]*$/.test(n) && !PUBLIC.includes(n.split('?')[0]) ? n : '';
      router.replace(safe || (user.role === 'admin' ? '/admin' : '/jobs'));
    }
  }, [ready, user, isPublic, path, router]);

  if (!ready || (!user && !isPublic) || (user && isPublic)) {
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="animate-spin text-brand" size={28} /></div>;
  }
  return children;
}
