'use client';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useAuth } from './AuthProvider';

export default function RequireAuth({ children, title = 'Sign in to continue' }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="mx-auto max-w-5xl px-4 py-16"><div className="card h-64 animate-pulse" /></div>;
  if (!user) return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-[10px] bg-brand-tint text-brand"><Lock /></span>
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-ink-soft">Create a free account to upload your CV, see matching jobs and get deadline reminders.</p>
      <div className="mt-6 flex justify-center gap-2"><Link href="/register" className="btn-primary">Create account</Link><Link href="/login" className="btn-ghost">Sign in</Link></div>
    </div>
  );
  return children;
}
