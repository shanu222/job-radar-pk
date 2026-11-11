'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from './AuthProvider';

export default function AuthForm({ mode }) {
  const isReg = mode === 'register';
  const router = useRouter();
  const { signIn } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { token, user } = await api(`/api/auth/${isReg ? 'register' : 'login'}`, { method: 'POST', body: isReg ? form : { email: form.email, password: form.password }, auth: false });
      signIn(token, user);
      router.push(isReg ? '/matches' : '/jobs');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
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
        {isReg && field('name', 'Full name', 'text', { autoComplete: 'name' })}
        {field('email', 'Email', 'email', { autoComplete: 'email' })}
        {field('password', 'Password', 'password', { minLength: 8, autoComplete: isReg ? 'new-password' : 'current-password' })}
        {error && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}
        <button disabled={busy} className="btn-primary h-11 w-full">{busy ? 'Please wait…' : isReg ? 'Create account' : 'Sign in'}</button>
        <p className="text-center text-sm text-ink-soft">
          {isReg ? <>Already have an account? <Link href="/login" className="font-semibold text-brand">Sign in</Link></> : <>New here? <Link href="/register" className="font-semibold text-brand">Create an account</Link></>}
        </p>
      </form>
    </div>
  );
}
