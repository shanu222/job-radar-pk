'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { api, qs, CATEGORY } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

const RANGES = [[3, '3 days'], [7, '1 week'], [14, '2 weeks'], [30, '1 month']];

function dayLabel(date) {
  const d = new Date(date + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  return { diff, top: diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'long' }), sub: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) };
}

export default function Deadlines() {
  const [days, setDays] = useState(14);
  const [category, setCategory] = useState('');
  const [country, setCountry] = useState('');
  const [data, setData] = useState(null);
  const { user, savedIds, toggleSave } = useAuth();

  useEffect(() => { setData(null); api(`/api/deadlines?${qs({ days, category, country })}`).then(setData).catch(() => setData({ groups: [] })); }, [days, category, country]);
  const total = useMemo(() => data?.groups.reduce((n, g) => n + g.jobs.length, 0) ?? 0, [data]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Deadlines</h1>
          <p className="mt-1 text-ink-soft">{data ? `${total} applications closing in the next ${days} days` : 'Loading…'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All types</option>{Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="input w-auto" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Anywhere</option><option value="PK">Pakistan</option><option value="INTL">International</option>
          </select>
          <div className="flex rounded-[8px] border border-line bg-white p-1">
            {RANGES.map(([v, l]) => <button key={v} onClick={() => setDays(v)} className={`rounded-[6px] px-3 py-1.5 text-sm ${days === v ? 'bg-brand-tint text-brand-dark' : 'text-ink-soft'}`}>{l}</button>)}
          </div>
        </div>
      </div>

      {!data && <div className="card h-64 animate-pulse" />}
      {data?.groups.length === 0 && <div className="card p-12 text-center text-ink-soft">No known deadlines in this range.</div>}

      <ol className="relative space-y-8 border-l-2 border-line pl-6 sm:pl-8">
        {data?.groups.map((g) => {
          const { diff, top, sub } = dayLabel(g.date);
          const urgent = diff <= 1, soon = diff <= 3;
          return (
            <li key={g.date} className="relative">
              <span className={`absolute -left-[33px] sm:-left-[41px] top-1 h-4 w-4 rounded-full border-4 border-paper ${urgent ? 'bg-danger' : soon ? 'bg-alert' : 'bg-line-strong'}`} />
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className={`font-display text-lg font-bold ${urgent ? 'text-danger' : ''}`}>{top}</h2>
                <span className="text-sm text-ink-soft">{sub}, {g.jobs.length} closing</span>
              </div>
              <div className="card divide-y divide-line">
                {g.jobs.map((j) => (
                  <div key={j.id} className="flex items-center gap-3 p-4">
                    <span className={`chip hidden sm:inline-flex ${(CATEGORY[j.category] || CATEGORY.private).cls}`}>{(CATEGORY[j.category] || CATEGORY.private).label}</span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/jobs/${j.id}`} className="block truncate font-medium hover:text-brand">{j.title}</Link>
                      <p className="truncate text-sm text-ink-soft">{j.company}{j.location ? `, ${j.location}` : ''}</p>
                    </div>
                    {user && (
                      <button onClick={() => toggleSave(j.id)} className={`rounded-[6px] p-2 ${savedIds.has(j.id) ? 'text-brand' : 'text-ink-soft hover:text-ink'}`} title="Save and remind me" aria-label="Save and remind me">
                        {savedIds.has(j.id) ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
