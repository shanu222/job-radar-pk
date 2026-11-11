'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Settings2 } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import RequireAuth from '@/components/RequireAuth';
import CvUpload from '@/components/CvUpload';
import Paywall from '@/components/Paywall';
import JobCard, { JobSkeleton } from '@/components/JobCard';

const TABS = [['', 'All matches'], ['govt', 'Government'], ['private', 'Private & NGO'], ['remote', 'Remote'], ['freelance', 'Gigs']];

function Matches() {
  const { user } = useAuth();
  const [category, setCategory] = useState('');
  const [closing, setClosing] = useState(false);
  const [data, setData] = useState(null);
  const [searching, setSearching] = useState(false);

  const load = useCallback(() => {
    setData(null);
    api(`/api/me/matches?${qs({ category, closing: closing ? 14 : '' })}`).then(setData).catch(() => setData({ jobs: [] }));
  }, [category, closing]);
  useEffect(() => { if (user?.access?.active && (user?.has_cv || user?.skills?.length)) load(); }, [load, user]);

  // After a CV upload the server searches Google Jobs (LinkedIn, Indeed, Rozee…) with this CV's
  // job titles in the background; refresh the list a couple of times while that finishes.
  const afterUpload = (_u, isSearching) => {
    if (!isSearching) return;
    setSearching(true);
    setTimeout(load, 20000);
    setTimeout(() => { load(); setSearching(false); }, 45000);
  };

  if (!user.access?.active) return <Paywall reason={user.access?.reason} />;

  if (!user.has_cv && !user.skills?.length) return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="font-display text-3xl font-bold">Find jobs that fit your CV</h1>
      <p className="mb-8 mt-2 text-ink-soft">We read your skills, job titles and experience, then score every job in Pakistan and abroad against them. Your CV stays private.</p>
      <CvUpload onDone={afterUpload} />
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        <aside className="min-w-0 space-y-4">
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display font-semibold">Your profile</h2>
              <Link href="/profile" className="text-ink-soft hover:text-ink" title="Edit"><Settings2 size={16} /></Link>
            </div>
            {user.titles?.length > 0 && <p className="mb-3 text-sm text-ink-soft">{user.titles.slice(0, 2).join(' · ')}</p>}
            {user.experience_years != null && <p className="mb-3 text-sm"><b>{user.experience_years}</b> years experience</p>}
            <div className="flex flex-wrap gap-1.5">{user.skills?.map((s) => <span key={s} className="chip bg-brand-tint text-brand-dark">{s}</span>)}</div>
          </div>
          <CvUpload compact onDone={(u, isSearching) => { load(); afterUpload(u, isSearching); }} />
        </aside>
        <section className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h1 className="flex items-center gap-2 font-display text-2xl font-bold"><Sparkles className="text-brand" size={22} /> Matched to your CV</h1>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="h-4 w-4 accent-[#0d6b45]" checked={closing} onChange={(e) => setClosing(e.target.checked)} /> Closing in 2 weeks
            </label>
          </div>
          {searching && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-brand/20 bg-brand-tint px-4 py-3 text-sm text-brand-dark">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
              Searching LinkedIn, Indeed, Rozee and more for jobs that fit your CV — new results will appear here in a moment.
            </div>
          )}
          <div className="mb-5 flex gap-1 overflow-x-auto">
            {TABS.map(([v, l]) => <button key={v} onClick={() => setCategory(v)} className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium ${category === v ? 'bg-ink text-white' : 'text-ink-soft hover:bg-white'}`}>{l}</button>)}
          </div>
          <div className="space-y-3">
            {!data && Array.from({ length: 5 }).map((_, i) => <JobSkeleton key={i} />)}
            {data?.jobs.map((j, i) => <JobCard key={j.id} job={j} index={i} />)}
            {data?.jobs.length === 0 && (
              <div className="card p-10 text-center">
                <p className="font-display text-lg font-semibold">No strong matches here yet</p>
                <p className="mt-1 text-sm text-ink-soft">New jobs arrive every few hours. Add more skills on your profile to widen the net.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function MatchesPage() {
  return <RequireAuth title="Sign in to see jobs matched to your CV"><Matches /></RequireAuth>;
}
