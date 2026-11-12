'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from './AuthProvider';
import { googleEnabled, googleIdToken, googleRedirectToken, preloadGoogle, CANCELLED } from '@/lib/firebase';
import { useToast } from './Toast';
import { COUNTRIES, PROVINCES } from '@/lib/places';

export default function AuthForm({ mode }) {
  const isReg = mode === 'register';
  const router = useRouter();
  const { signIn } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', country: 'PK', domicile: '' });
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const toast = useToast();

  const finishGoogle = async (idToken) => {
    const { token, user } = await api('/api/auth/google', { method: 'POST', body: { idToken }, auth: false });
    signIn(token, user);
    router.push(user.role === 'admin' ? '/admin' : user.has_cv ? '/matches' : '/jobs');
  };

  useEffect(() => {
    if (!googleEnabled) return;
    // Load Google sign-in ahead of the click so the popup isn't blocked, and finish a redirect sign-in if one is in progress
    preloadGoogle()?.catch(() => {});
    googleRedirectToken()
      .then((t) => { if (t) { setGoogleBusy(true); return finishGoogle(t); } })
      .catch((e) => toast.error(e, 'Google sign-in didn’t work. Please try again or use email sign-in.'))
      .finally(() => setGoogleBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const { token, user } = await api(`/api/auth/${isReg ? 'register' : 'login'}`, { method: 'POST', body: isReg ? { ...form, domicile: form.country === 'PK' ? form.domicile : undefined } : { email: form.email, password: form.password }, auth: false });
      signIn(token, user);
      router.push(user.role === 'admin' ? '/admin' : isReg ? '/matches' : '/jobs');
    } catch (err) { toast.error(err); } finally { setBusy(false); }
  }

  function google() {
    // No awaits before googleIdToken(): the popup must open inside this click
    setGoogleBusy(true);
    googleIdToken()
      .then((idToken) => idToken && finishGoogle(idToken))
      .catch((err) => { if (!CANCELLED.has(err?.code)) toast.error(err, 'Google sign-in didn’t work. Please try again or use email sign-in.'); })
      .finally(() => setGoogleBusy(false));
  }

  const field = (k, label, type = 'text', extra = {}) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input className="input" type={type} required value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} {...extra} />
    </label>
  );

  return (
    <div className="grain flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <form onSubmit={submit} className="card rise w-full max-w-md space-y-4 p-8 shadow-[0_20px_60px_-25px_rgba(11,31,23,.3)]">
        <div className="mb-2">
          <h1 className="font-display text-2xl font-bold">{isReg ? 'Create your free account' : 'Welcome back'}</h1>
          <p className="mt-1 text-sm text-ink-soft">{isReg ? 'Upload your CV next and we’ll start matching jobs to you.' : 'Sign in to see your matches and deadlines.'}</p>
        </div>
        {googleEnabled && (
          <>
            <button type="button" onClick={google} disabled={busy || googleBusy} className="btn-ghost h-11 w-full">
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
              {googleBusy ? 'Signing in…' : 'Continue with Google'}
            </button>
            <div className="flex items-center gap-3 text-xs text-ink-soft"><span className="h-px flex-1 bg-line" />or with email<span className="h-px flex-1 bg-line" /></div>
          </>
        )}
        {isReg && field('name', 'Full name', 'text', { autoComplete: 'name' })}
        {field('email', 'Email', 'email', { autoComplete: 'email' })}
        {isReg && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-sm font-medium">Country</span>
              <select className="input" required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
                {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select></label>
            {form.country === 'PK' && (
              <label className="block"><span className="mb-1.5 block text-sm font-medium">Domicile</span>
                <select className="input" required value={form.domicile} onChange={(e) => setForm({ ...form, domicile: e.target.value })}>
                  <option value="" disabled>Select province</option>
                  {PROVINCES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                </select></label>
            )}
          </div>
        )}
        {isReg && <p className="-mt-1 text-xs text-ink-soft">Used to show only government jobs open to your domicile and international jobs open to applicants from your country.</p>}
        {field('password', 'Password', 'password', { minLength: 8, maxLength: 128, autoComplete: isReg ? 'new-password' : 'current-password' })}
        <button disabled={busy || googleBusy} className="btn-primary h-11 w-full">{busy ? 'Please wait…' : isReg ? 'Create account' : 'Sign in'}</button>
        <p className="text-center text-sm text-ink-soft">
          {isReg ? <>Already have an account? <Link href="/login" className="font-semibold text-brand">Sign in</Link></> : <>New here? <Link href="/register" className="font-semibold text-brand">Create an account</Link></>}
        </p>
      </form>
    </div>
  );
}
