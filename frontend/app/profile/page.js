'use client';
import { useState } from 'react';
import { X, Check, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import RequireAuth from '@/components/RequireAuth';
import CvUpload from '@/components/CvUpload';

function ChipInput({ value, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const add = () => { const v = draft.trim().toLowerCase(); if (v && !value.includes(v)) onChange([...value, v]); setDraft(''); };
  return (
    <div className="input flex min-h-12 flex-wrap items-center gap-1.5 py-2">
      {value.map((s) => (
        <span key={s} className="chip bg-brand-tint text-brand-dark">{s}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== s))}><X size={12} /></button>
        </span>
      ))}
      <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }} onBlur={add}
        className="min-w-[140px] flex-1 bg-transparent outline-none" />
    </div>
  );
}

const CATS = [['govt', 'Government'], ['private', 'Private & NGO'], ['remote', 'International remote'], ['freelance', 'Freelance / gigs']];

function PasswordForm() {
  const { user, signIn } = useAuth();
  const [f, setF] = useState({ current: '', next: '' });
  const [msg, setMsg] = useState(null);
  const submit = async (e) => {
    e.preventDefault(); setMsg(null);
    try {
      const { token, user: u } = await api('/api/auth/password', { method: 'POST', body: user.has_password ? f : { next: f.next } });
      signIn(token, u); setF({ current: '', next: '' }); setMsg({ ok: 'Password updated. Other devices have been signed out.' });
    } catch (err) { setMsg({ err: err.message }); }
  };
  return (
    <form onSubmit={submit} className="card mt-6 space-y-4 p-6 sm:p-8">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold"><KeyRound size={18} /> {user.has_password ? 'Change password' : 'Set a password'}</h2>
      {!user.has_password && <p className="text-sm text-ink-soft">You sign in with Google. Set a password if you also want to sign in with email.</p>}
      {user.has_password && <input type="password" className="input" placeholder="Current password" required autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />}
      <input type="password" className="input" placeholder="New password (8+ characters, letters and numbers)" required minLength={8} maxLength={128} autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
      {msg?.err && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{msg.err}</p>}
      {msg?.ok && <p className="rounded-lg bg-brand-tint px-3 py-2 text-sm text-brand-dark">{msg.ok}</p>}
      <button className="btn-ghost">Update password</button>
    </form>
  );
}

function Profile() {
  const { user, setUser } = useAuth();
  const [p, setP] = useState({
    name: user.name || '', skills: user.skills || [], titles: user.titles || [], experience_years: user.experience_years ?? '',
    pref_locations: user.pref_locations || [], pref_categories: user.pref_categories || [], email_alerts: user.email_alerts,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault(); setError('');
    try {
      const { user } = await api('/api/auth/me', { method: 'PATCH', body: { ...p, experience_years: p.experience_years === '' ? null : Number(p.experience_years) } });
      setUser(user); setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Profile & alerts</h1>
      <p className="mb-8 mt-1 text-ink-soft">{user.email}{user.google ? ' · Google account' : ''} · {user.access?.active ? <Link href="/billing" className="font-semibold text-brand">Pro active</Link> : <Link href="/billing" className="font-semibold text-brand">Upgrade to Pro</Link>}</p>
      <div className="mb-8"><CvUpload compact onDone={(u) => setP((x) => ({ ...x, skills: u.skills, titles: u.titles, experience_years: u.experience_years ?? '' }))} /></div>
      <form onSubmit={save} className="card space-y-6 p-6 sm:p-8">
        <label className="block"><span className="label">Name</span><input className="input mt-2" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></label>
        <div><span className="label">Skills</span><p className="mb-2 text-xs text-ink-soft">Read from your CV — add or remove to fine-tune your matches.</p>
          <ChipInput value={p.skills} onChange={(skills) => setP({ ...p, skills })} placeholder="Add a skill and press Enter" /></div>
        <div><span className="label">Job titles you want</span>
          <div className="mt-2"><ChipInput value={p.titles} onChange={(titles) => setP({ ...p, titles })} placeholder="e.g. full stack developer" /></div></div>
        <label className="block w-40"><span className="label">Years of experience</span>
          <input type="number" min="0" max="50" className="input mt-2" value={p.experience_years} onChange={(e) => setP({ ...p, experience_years: e.target.value })} /></label>
        <div><span className="label">Preferred locations</span>
          <div className="mt-2"><ChipInput value={p.pref_locations} onChange={(pref_locations) => setP({ ...p, pref_locations })} placeholder="Islamabad, Lahore, Remote…" /></div></div>
        <div><span className="label">Job types</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATS.map(([k, l]) => {
              const on = p.pref_categories.includes(k);
              return <button type="button" key={k} onClick={() => setP({ ...p, pref_categories: on ? p.pref_categories.filter((x) => x !== k) : [...p.pref_categories, k] })}
                className={`rounded-lg border px-3 py-1.5 text-sm ${on ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}>{l}</button>;
            })}
          </div></div>
        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl bg-paper p-4">
          <span><b className="text-sm">Daily email alerts</b><span className="block text-sm text-ink-soft">Saved & matching jobs closing soon, plus new strong matches. Sent around 9 AM.</span></span>
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[#0d6b45]" checked={p.email_alerts} onChange={(e) => setP({ ...p, email_alerts: e.target.checked })} />
        </label>
        {error && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}
        <button className="btn-primary">{saved ? <><Check size={16} /> Saved</> : 'Save changes'}</button>
      </form>
      <PasswordForm />
    </div>
  );
}

export default function ProfilePage() { return <RequireAuth><Profile /></RequireAuth>; }
