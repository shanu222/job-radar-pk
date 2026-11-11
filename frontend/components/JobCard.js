'use client';
import Link from 'next/link';
import { Bookmark, BookmarkCheck, MapPin, Building2, ExternalLink, Globe2 } from 'lucide-react';
import { CATEGORY, SOURCE_LABEL, timeAgo } from '@/lib/api';
import { useAuth } from './AuthProvider';
import { useRouter } from 'next/navigation';
import { eligibilityLabel } from '@/lib/places';

export function DeadlineBadge({ deadline, daysLeft, compact }) {
  if (!deadline) return compact ? null : <span className="chip bg-paper text-ink-soft">Open until filled</span>;
  const d = Number(daysLeft);
  const cls = d <= 1 ? 'bg-danger-tint text-danger' : d <= 3 ? 'bg-alert-tint text-alert' : d <= 7 ? 'bg-amber-50 text-amber-800' : 'bg-paper text-ink-soft';
  const txt = d === 0 ? 'Closes today' : d === 1 ? 'Closes tomorrow' : `${d} days left`;
  return (
    <span className={`chip ${cls}`} title={`Deadline ${deadline}`}>
      {d <= 3 && <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" /></span>}
      {txt}
    </span>
  );
}

export function MatchRing({ score }) {
  const c = 2 * Math.PI * 16;
  const color = score >= 70 ? '#0d6b45' : score >= 50 ? '#ca8a04' : '#94a3b8';
  return (
    <div className="relative grid h-12 w-12 shrink-0 place-items-center" title={`${score}% match with your CV`}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r="16" fill="none" stroke="#eceae2" strokeWidth="4" />
        <circle cx="20" cy="20" r="16" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <span className="text-xs font-bold">{score}%</span>
    </div>
  );
}

export default function JobCard({ job, index = 0 }) {
  const { user, savedIds, toggleSave } = useAuth();
  const router = useRouter();
  const saved = savedIds.has(job.id);
  const cat = CATEGORY[job.category] || CATEGORY.private;
  return (
    <article className="card rise group relative p-5 transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-12px_rgba(11,31,23,.18)]" style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}>
      <div className="flex gap-4">
        {job.score != null && <MatchRing score={job.score} />}
        <div className="min-w-0 flex-1 break-words">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className={`chip ${cat.cls}`}>{cat.label}</span>
            {job.is_remote && job.category !== 'remote' && <span className="chip bg-violet-50 text-violet-800"><Globe2 size={11} />Remote</span>}
            {job.country === 'PK' && <span className="chip bg-paper text-ink-soft">🇵🇰 Pakistan</span>}
            {eligibilityLabel(job) && <span className="chip border border-brand/25 text-brand-dark">{eligibilityLabel(job)}</span>}
            <DeadlineBadge deadline={job.deadline} daysLeft={job.days_left} compact />
          </div>
          <Link href={`/jobs/${job.id}`} className="font-display text-[17px] font-semibold leading-snug text-ink after:absolute after:inset-0 group-hover:text-brand">
            {job.title}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
            {job.company && <span className="flex items-center gap-1"><Building2 size={14} />{job.company}</span>}
            {job.location && <span className="flex items-center gap-1"><MapPin size={14} />{job.location}</span>}
          </div>
          {job.snippet && <p className="mt-2.5 line-clamp-2 text-sm text-ink-soft/90">{job.snippet}</p>}
          {job.matchedSkills?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.matchedSkills.slice(0, 6).map((s) => <span key={s} className="chip bg-brand-tint text-brand-dark">✓ {s}</span>)}
              {job.missingSkills?.slice(0, 3).map((s) => <span key={s} className="chip border border-dashed border-line text-ink-soft">{s}</span>)}
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-xs text-ink-soft">
            <span>via {SOURCE_LABEL[job.source] || job.source}{job.posted_at ? ` · ${timeAgo(job.posted_at)}` : ''}{job.salary ? ` · ${job.salary}` : ''}</span>
          </div>
        </div>
        <div className="relative z-10 flex flex-col items-end gap-2">
          <button
            onClick={() => (user ? toggleSave(job.id) : router.push('/register'))}
            className={`rounded-lg p-2 transition ${saved ? 'bg-brand text-white' : 'text-ink-soft hover:bg-paper hover:text-ink'}`}
            title={saved ? 'Saved — you will get deadline reminders' : 'Save & get deadline reminders'}>
            {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
          </button>
          <a href={job.url} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-ink-soft hover:bg-paper hover:text-ink" title="Open original posting">
            <ExternalLink size={18} />
          </a>
        </div>
      </div>
    </article>
  );
}

export function JobSkeleton() {
  return (
    <div className="card animate-pulse p-5">
      <div className="mb-3 h-4 w-24 rounded bg-paper" />
      <div className="mb-2 h-5 w-3/4 rounded bg-paper" />
      <div className="h-4 w-1/2 rounded bg-paper" />
    </div>
  );
}
