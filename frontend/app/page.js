'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Landmark, Briefcase, Globe2, MessagesSquare, CalendarClock, FileText, BellRing, ArrowRight } from 'lucide-react';
import { api, fmtDate } from '@/lib/api';
import { DeadlineBadge } from '@/components/JobCard';

const CATS = [
  { key: 'govt', icon: Landmark, title: 'Government', desc: 'FPSC, PPSC, KPPSC, SPSC, BPSC, NTS, PTS & newspaper ads', q: 'category=govt' },
  { key: 'private', icon: Briefcase, title: 'Private & NGO', desc: 'Pakistani companies, banks, telecoms, UN & INGOs', q: 'category=private&country=PK' },
  { key: 'remote', icon: Globe2, title: 'International remote', desc: 'Work from Pakistan for companies worldwide', q: 'remote=true' },
  { key: 'freelance', icon: MessagesSquare, title: 'Reddit & gigs', desc: 'Hiring posts from r/forhire, r/remotejs, r/PakistanJobs…', q: 'category=freelance' },
];

export default function Home() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [stats, setStats] = useState(null);
  const [closing, setClosing] = useState([]);

  useEffect(() => {
    api('/api/jobs/stats', { auth: false }).then(setStats).catch(() => {});
    api('/api/jobs?deadline=7&sort=deadline&size=6', { auth: false }).then((d) => setClosing(d.jobs)).catch(() => {});
  }, []);

  const count = (k) => (stats ? (k === 'remote' ? stats.remote : stats[k]) : null);

  return (
    <>
      <section className="grain relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pt-24">
          <div className="rise max-w-3xl">
            <span className="chip mb-6 border border-brand/20 bg-white text-brand-dark">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {stats ? `${stats.new_today.toLocaleString()} new jobs in the last 24 hours` : 'Updated every 3 hours'}
            </span>
            <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              Every job in Pakistan<br />and remote — <span className="relative whitespace-nowrap text-brand">
                before the deadline
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" preserveAspectRatio="none"><path d="M2 9c60-6 180-8 296-3" stroke="#b7f0c9" strokeWidth="6" fill="none" strokeLinecap="round" /></svg>
              </span>.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-ink-soft">
              Government commissions, private companies, UN &amp; NGOs, international remote boards and Reddit hiring posts — in one search.
              Upload your CV and we show what fits you, then remind you before applications close.
            </p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); router.push(`/jobs?q=${encodeURIComponent(q)}`); }}
            className="rise mt-9 flex max-w-2xl gap-2 rounded-2xl border border-line bg-white p-2 shadow-[0_20px_50px_-20px_rgba(11,31,23,.25)]" style={{ animationDelay: '80ms' }}>
            <div className="flex flex-1 items-center gap-2 px-3">
              <Search size={18} className="text-ink-soft" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try “lecturer BS-18”, “react developer”, “NDMA”…" className="w-full bg-transparent py-2 outline-none placeholder:text-ink-soft/60" />
            </div>
            <button className="btn-primary px-6">Search</button>
          </form>
          <div className="rise mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm text-ink-soft" style={{ animationDelay: '140ms' }}>
            {[['total', 'live jobs'], ['pakistan', 'in Pakistan'], ['closing_week', 'closing this week']].map(([k, l]) => (
              <span key={k}><b className="font-display text-xl text-ink">{stats ? stats[k].toLocaleString() : '—'}</b> {l}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATS.map(({ key, icon: Icon, title, desc, q }, i) => (
            <Link key={key} href={`/jobs?${q}`} className="card rise group p-5 transition hover:border-brand/40 hover:shadow-lg" style={{ animationDelay: `${200 + i * 60}ms` }}>
              <div className="mb-4 flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-tint text-brand"><Icon size={20} /></span>
                <span className="font-display text-2xl font-bold">{count(key)?.toLocaleString() ?? ''}</span>
              </div>
              <h3 className="font-display font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{desc}</p>
              <span className="mt-4 flex items-center gap-1 text-sm font-semibold text-brand opacity-0 transition group-hover:opacity-100">Browse <ArrowRight size={14} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-5">
        <div className="card p-6 lg:col-span-3">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold"><CalendarClock className="text-alert" size={22} /> Closing this week</h2>
            <Link href="/deadlines" className="text-sm font-semibold text-brand hover:underline">All deadlines →</Link>
          </div>
          <ul className="divide-y divide-line">
            {closing.length === 0 && <li className="py-8 text-center text-sm text-ink-soft">No deadlines in the next 7 days yet.</li>}
            {closing.map((j) => (
              <li key={j.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <Link href={`/jobs/${j.id}`} className="block truncate font-medium hover:text-brand">{j.title}</Link>
                  <p className="truncate text-sm text-ink-soft">{j.company} · {fmtDate(j.deadline)}</p>
                </div>
                <DeadlineBadge deadline={j.deadline} daysLeft={j.days_left} />
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col justify-between rounded-2xl bg-ink p-7 text-white lg:col-span-2">
          <div>
            <h2 className="font-display text-2xl font-bold leading-tight">Let your CV do the searching.</h2>
            <ul className="mt-6 space-y-4 text-sm text-white/80">
              <li className="flex gap-3"><FileText className="shrink-0 text-mint" size={20} />Upload a PDF or Word CV — we read your skills, titles and experience.</li>
              <li className="flex gap-3"><Search className="shrink-0 text-mint" size={20} />Every job gets a match score, with the skills you have and the ones you’re missing.</li>
              <li className="flex gap-3"><BellRing className="shrink-0 text-mint" size={20} />Daily email when a saved or matching job is about to close.</li>
            </ul>
          </div>
          <Link href="/matches" className="btn mt-8 bg-mint text-ink hover:bg-white">Upload my CV <ArrowRight size={16} /></Link>
        </div>
      </section>
    </>
  );
}
