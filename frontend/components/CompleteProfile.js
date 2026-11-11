'use client';
// Asks users who signed up with Google (no country yet) for their country and domicile,
// so jobs can be filtered to ones they can actually apply for.
import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { COUNTRIES, PROVINCES } from '@/lib/places';
import { useAuth } from './AuthProvider';

export default function CompleteProfile() {
  const { user, setUser } = useAuth();
  const [country, setCountry] = useState('PK');
  const [domicile, setDomicile] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!user || user.country || user.role === 'admin') return null;

  const save = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const { user: u } = await api('/api/auth/me', { method: 'PATCH', body: { country, ...(country === 'PK' ? { domicile } : {}) } });
      setUser(u);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/50 sm:items-center sm:p-4">
      <form onSubmit={save} className="rise w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-2xl">
        <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-brand-tint text-brand"><MapPin size={20} /></span>
        <h2 className="font-display text-xl font-bold">One more step{user.name ? `, ${user.name.split(' ')[0]}` : ''}</h2>
        <p className="mt-1 text-sm text-ink-soft">So we only show jobs you can really apply for — government posts open to your domicile and international jobs open to your country.</p>
        <label className="mt-5 block"><span className="mb-1.5 block text-sm font-medium">Country</span>
          <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
            {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select></label>
        {country === 'PK' && (
          <label className="mt-3 block"><span className="mb-1.5 block text-sm font-medium">Domicile</span>
            <select className="input" required value={domicile} onChange={(e) => setDomicile(e.target.value)}>
              <option value="" disabled>Select province</option>
              {PROVINCES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select></label>
        )}
        {error && <p className="mt-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}
        <button disabled={busy || (country === 'PK' && !domicile)} className="btn-primary mt-5 h-11 w-full">{busy ? 'Saving…' : 'Continue'}</button>
      </form>
    </div>
  );
}
