'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthShowcase from './AuthShowcase';
import { api } from '@/lib/api';
import { useAuth } from './AuthProvider';
import { googleEnabled, googleIdToken, googleRedirectToken, preloadGoogle, CANCELLED } from '@/lib/firebase';
import { useToast } from './Toast';
import GoogleButton, { gisEnabled } from './GoogleButton';
import { COUNTRIES, PROVINCES } from '@/lib/places';

export default function AuthForm({ mode }) {
  const isReg = mode === 'register';
  const router = useRouter();
  const sp = useSearchParams();
  // Where to go after signing in (only same-site paths)
  const nextRaw = sp.get('next') || '';
  const next = /^\/(?!\/)[^\s]*$/.test(nextRaw) && !/^\/(login|register)?$/.test(nextRaw.split('?')[0]) ? nextRaw : '';
  const { signIn } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', country: 'PK', domicile: '' });
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [gisFailed, setGisFailed] = useState(false);
  // Set when the server needs the emailed 6-digit code before signing in
  const [verify, setVerify] = useState(null);
  const toast = useToast();

  const finishGoogle = async (idToken) => {
    const { token, user } = await api('/api/auth/google', { method: 'POST', body: { idToken }, auth: false });
    signIn(token, user);
    router.replace(next || (user.role === 'admin' ? '/admin' : '/jobs'));
  };

  useEffect(() => {
    if (!googleEnabled || gisEnabled) return;
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
      router.replace(next || (user.role === 'admin' ? '/admin' : isReg ? '/billing' : '/jobs'));
    } catch (err) {
      if (err.data?.needsVerification) setVerify({ email: err.data.email || form.email, sentTo: err.data.sentTo, isNew: isReg });
      else toast.error(err);
    } finally { setBusy(false); }
  }

  function onGoogleCredential(idToken) {
    setGoogleBusy(true);
    finishGoogle(idToken)
      .catch((err) => toast.error(err, 'Google sign-in didn’t work. Please try again or use email sign-in.'))
      .finally(() => setGoogleBusy(false));
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

  if (verify) return <VerifyEmail {...verify} onBack={() => setVerify(null)} onDone={(token, user) => { signIn(token, user); router.replace(next || (user.role === 'admin' ? '/admin' : verify.isNew ? '/billing' : '/jobs')); }} />;

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
      <div className="order-2 hidden lg:order-1 lg:block"><AuthShowcase /></div>
      <form onSubmit={submit} className="card order-1 mx-auto w-full max-w-md space-y-4 p-6  sm:p-8 lg:order-2 lg:sticky lg:top-24">
        <div className="mb-2">
          <h1 className="font-display text-2xl font-bold">{isReg ? 'Create your free account' : 'Sign in to JobRadar PK'}</h1>
          <p className="mt-1 text-sm text-ink-soft">{isReg ? 'Free to browse every job. Upgrade any time to let your CV filter jobs for you.' : 'Government, private and remote jobs, with the last date for each.'}</p>
        </div>
        {(gisEnabled || googleEnabled) && (
          <>
            {gisEnabled ? (
              <GoogleButton mode={isReg ? 'signup' : 'signin'} onCredential={onGoogleCredential} onError={() => setGisFailed(true)} disabled={busy || googleBusy}
                fallback={googleEnabled ? (
            <button type="button" onClick={google} disabled={busy || googleBusy} className="btn-ghost h-11 w-full">
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
                {googleBusy ? 'Signing in…' : 'Continue with Google'}
              </button>
                ) : null} />
            ) : googleEnabled ? (
            <button type="button" onClick={google} disabled={busy || googleBusy} className="btn-ghost h-11 w-full">
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
                {googleBusy ? 'Signing in…' : 'Continue with Google'}
              </button>
            ) : null}
            {googleBusy && <p className="text-center text-xs text-ink-soft">Signing you in…</p>}
            {!(gisFailed && !googleEnabled) && <div className="flex items-center gap-3 text-xs text-ink-soft"><span className="h-px flex-1 bg-line" />or with email<span className="h-px flex-1 bg-line" /></div>}
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
      <div className="order-3 lg:hidden"><AuthShowcase compact /></div>
      </div>
    </div>
  );
}

function VerifyEmail({ email, sentTo, onBack, onDone }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(60);
  const toast = useToast();

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const { token, user } = await api('/api/auth/verify', { method: 'POST', body: { email, code }, auth: false });
      onDone(token, user);
    } catch (err) { toast.error(err); setCode(''); } finally { setBusy(false); }
  }

  async function resend() {
    try {
      await api('/api/auth/verify/resend', { method: 'POST', body: { email }, auth: false });
      toast.success('A new code is on its way');
      setWait(60);
    } catch (err) { toast.error(err); }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-12 sm:px-6">
      <form onSubmit={submit} className="card mx-auto w-full max-w-md space-y-5 p-6 sm:p-8">
        <div>
          <h1 className="font-display text-2xl font-bold">Check your email</h1>
          <p className="mt-1 text-sm text-ink-soft">We sent a 6-digit code to <b className="text-ink">{sentTo || email}</b>. Enter it below to confirm your email and sign in.</p>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Verification code</span>
          <input className="input tabular h-12 text-center text-2xl font-semibold tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" autoFocus
            required pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
        </label>
        <button disabled={busy || code.length !== 6} className="btn-primary h-11 w-full">{busy ? 'Checking…' : 'Verify and continue'}</button>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button type="button" onClick={onBack} className="text-ink-soft hover:text-ink">Use a different email</button>
          {wait > 0 ? <span className="tabular text-ink-soft">Resend code in {wait}s</span>
            : <button type="button" onClick={resend} className="font-semibold text-brand">Resend code</button>}
        </div>
        <p className="text-xs text-ink-soft">The code expires in 15 minutes. Can’t find it? Check your spam or promotions folder.</p>
      </form>
    </div>
  );
}
