'use client';
// The "why sign up" panel shown beside the sign-in / sign-up form.
import { useEffect, useState } from 'react';
import { Landmark, Globe2, FileSearch, ListChecks, BellRing, Wand2, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';

const FEATURES = [
  [Landmark, 'Every government job in one place', 'FPSC, PPSC, KPPSC, SPSC, BPSC, NTS, PTS and newspaper ads — plus private, NGO and UN vacancies.'],
  [ShieldCheck, 'Only jobs you can actually apply for', 'Filtered by your domicile for government posts, and by your country for international remote jobs.'],
  [FileSearch, 'Your CV finds the right post', 'Upload your CV and we pick the exact post that fits you — even from a 20-post consolidated advertisement.'],
  [ListChecks, 'The full ad, summarised', 'Requirements, age limit, qualification, test service, fee and how to apply — read from the official PDF for you.'],
  [BellRing, 'Never miss a deadline', 'Email reminders before applications close, and a calendar feed for your saved jobs.'],
  [Wand2, 'AI fit check & cover letters', 'See how well you fit a job and get a tailored cover letter in seconds.'],
  [Globe2, 'International remote work', 'Remote jobs from global boards and LinkedIn, Indeed & Rozee via Google Jobs — open to Pakistani applicants.'],
];

export default function AuthShowcase({ compact = false }) {
  const [stats, setStats] = useState(null);
  const [plan, setPlan] = useState(null);
  useEffect(() => {
    api('/api/jobs/stats', { auth: false }).then(setStats).catch(() => {});
    api('/api/billing/plan', { auth: false }).then(setPlan).catch(() => {});
  }, []);
  const price = plan ? `Rs ${plan.price_pkr.toLocaleString()}` : 'Rs 1,000';

  return (
    <div className={`relative overflow-hidden rounded-3xl bg-ink text-white ${compact ? 'p-6' : 'p-8 lg:p-10'}`}>
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-mint/10 blur-3xl" />
      <div className="relative">
        {!compact && (
          <span className="chip mb-5 border border-white/15 bg-white/5 text-mint">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" />
            {stats ? `${stats.new_today.toLocaleString()} new jobs in the last 24 hours` : 'Updated every 3 hours'}
          </span>
        )}
        <h2 className={`font-display font-extrabold leading-[1.1] tracking-tight ${compact ? 'text-2xl' : 'text-3xl lg:text-[2.6rem]'}`}>
          Every job in Pakistan &amp; remote — <span className="text-mint">matched to your CV</span>, before the deadline.
        </h2>
        {stats && (
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[[stats.total, 'live jobs'], [stats.govt, 'government'], [stats.closing_week, 'closing this week']].map(([n, l]) => (
              <div key={l} className="rounded-2xl bg-white/5 px-3 py-3 ring-1 ring-white/10">
                <p className="font-display text-xl font-bold sm:text-2xl">{Number(n || 0).toLocaleString()}</p>
                <p className="text-[11px] uppercase tracking-wider text-white/60">{l}</p>
              </div>
            ))}
          </div>
        )}
        <ul className={`mt-7 grid gap-4 ${compact ? '' : 'sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2'}`}>
          {(compact ? FEATURES.slice(0, 4) : FEATURES).map(([Icon, title, text]) => (
            <li key={title} className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-mint"><Icon size={18} /></span>
              <span><b className="block text-sm">{title}</b><span className="text-sm text-white/65">{text}</span></span>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-sm">
          <span><b>Free:</b> <span className="text-white/70">browse all jobs, deadlines, saved-job reminders</span></span>
          <span><b className="text-mint">Pro {price}/month:</b> <span className="text-white/70">CV matching, full-ad summaries, AI tools</span></span>
        </div>
      </div>
    </div>
  );
}
