'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { api, qs, SOURCE_LABEL } from '@/lib/api';
import JobCard, { JobSkeleton } from '@/components/JobCard';
import { useAuth } from '@/components/AuthProvider';
import { COUNTRY_NAME, PROVINCE_NAME } from '@/lib/places';

const CATEGORIES = [['', 'All'], ['govt', 'Government'], ['private', 'Private & NGO'], ['remote', 'Remote'], ['freelance', 'Reddit / gigs']];
const COUNTRIES = [['', 'Anywhere'], ['PK', 'Pakistan'], ['INTL', 'International']];
const DEADLINES = [['', 'Any'], ['3', '3 days'], ['7', '7 days'], ['30', '30 days'], ['has', 'Has deadline']];

function Pills({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, l]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`rounded-lg border px-3 py-1.5 text-sm transition ${value === v ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink/30'}`}>{l}</button>
      ))}
    </div>
  );
}

function JobsInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const f = Object.fromEntries(sp.entries());
  const [q, setQ] = useState(f.q || '');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const { user } = useAuth();
  const who = `${COUNTRY_NAME[user?.country || 'PK']}${user?.domicile ? ` · ${PROVINCE_NAME[user.domicile]} domicile` : ''}`;

  const set = (patch) => router.push(`/jobs?${qs({ ...f, page: undefined, ...patch })}`, { scroll: false });

  useEffect(() => {
    setData(null); setError('');
    api(`/api/jobs?${qs({ ...f, size: 20 })}`).then(setData).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.toString(), user?.country, user?.domicile]);

  const activeCount = ['category', 'country', 'remote', 'deadline', 'source', 'eligible'].filter((k) => f[k]).length;

  const filters = (
    <div className="space-y-6">
      <div><p className="label mb-2">Type</p><Pills options={CATEGORIES} value={f.category || ''} onChange={(v) => set({ category: v })} /></div>
      <div><p className="label mb-2">Location</p><Pills options={COUNTRIES} value={f.country || ''} onChange={(v) => set({ country: v })} /></div>
      <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-brand/30 bg-brand-tint/50 px-3.5 py-3 text-sm font-medium">
        <span>Only jobs I can apply for<span className="block text-xs font-normal text-ink-soft">{who}</span></span>
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0d6b45]" checked={f.eligible !== 'all'} onChange={(e) => set({ eligible: e.target.checked ? '' : 'all' })} />
      </label>
      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-white px-3.5 py-3 text-sm font-medium">
        Remote only
        <input type="checkbox" className="h-4 w-4 accent-[#0d6b45]" checked={f.remote === 'true'} onChange={(e) => set({ remote: e.target.checked ? 'true' : '' })} />
      </label>
      <div><p className="label mb-2">Deadline within</p><Pills options={DEADLINES} value={f.deadline || ''} onChange={(v) => set({ deadline: v })} /></div>
      <div>
        <p className="label mb-2">Source</p>
        <select className="input" value={f.source || ''} onChange={(e) => set({ source: e.target.value })}>
          <option value="">All sources</option>
          {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {activeCount > 0 && <button onClick={() => router.push(`/jobs?${qs({ q: f.q })}`)} className="text-sm font-semibold text-danger">Clear filters</button>}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <form onSubmit={(e) => { e.preventDefault(); set({ q }); }} className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input className="input h-12 pl-11 text-base" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Job title, skill, organisation or BPS scale…" />
        </div>
        <button className="btn-primary h-12 px-6">Search</button>
        <button type="button" onClick={() => setShowFilters(true)} className="btn-ghost h-12 lg:hidden"><SlidersHorizontal size={16} />{activeCount || ''}</button>
      </form>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block"><div className="sticky top-24">{filters}</div></aside>
        {showFilters && (
          <div className="fixed inset-0 z-50 bg-ink/40 lg:hidden" onClick={() => setShowFilters(false)}>
            <div className="absolute bottom-0 max-h-[85vh] w-full overflow-auto rounded-t-3xl bg-paper p-6" onClick={(e) => e.stopPropagation()}>
              <div className="mb-5 flex items-center justify-between"><h3 className="font-display text-lg font-bold">Filters</h3><button onClick={() => setShowFilters(false)}><X /></button></div>
              {filters}
            </div>
          </div>
        )}
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">{data ? <><b className="text-ink">{data.total.toLocaleString()}</b> jobs{f.q ? <> for “{f.q}”</> : ''}</> : 'Loading…'}</p>
            <select className="input w-auto py-2" value={f.sort || 'newest'} onChange={(e) => set({ sort: e.target.value })}>
              <option value="newest">Newest first</option>
              <option value="deadline">Closing soonest</option>
              {f.q && <option value="relevance">Most relevant</option>}
            </select>
          </div>
          {error && <div className="card border-danger/30 bg-danger-tint p-5 text-sm text-danger">Couldn’t load jobs: {error}</div>}
          <div className="space-y-3">
            {!data && !error && Array.from({ length: 6 }).map((_, i) => <JobSkeleton key={i} />)}
            {data?.jobs.map((j, i) => <JobCard key={j.id} job={j} index={i} />)}
            {data && data.jobs.length === 0 && (
              <div className="card p-12 text-center">
                <p className="font-display text-lg font-semibold">No jobs match these filters</p>
                <p className="mt-1 text-sm text-ink-soft">Try a broader search or remove a filter.</p>
              </div>
            )}
          </div>
          {data?.pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button disabled={data.page <= 1} onClick={() => set({ page: data.page - 1 })} className="btn-ghost">← Previous</button>
              <span className="px-3 text-sm text-ink-soft">Page {data.page} of {data.pages}</span>
              <button disabled={data.page >= data.pages} onClick={() => set({ page: data.page + 1 })} className="btn-ghost">Next →</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function JobsPage() {
  return <Suspense><JobsInner /></Suspense>;
}
