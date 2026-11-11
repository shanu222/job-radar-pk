'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, MapPin, CalendarDays, ExternalLink, Bookmark, BookmarkCheck, Wallet } from 'lucide-react';
import { api, CATEGORY, SOURCE_LABEL, fmtDate, timeAgo } from '@/lib/api';
import { DeadlineBadge, MatchRing } from '@/components/JobCard';
import { useAuth } from '@/components/AuthProvider';
import AiTools from '@/components/AiTools';

export default function JobDetail({ params }) {
  const { id } = use(params);
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const { user, savedIds, toggleSave } = useAuth();

  useEffect(() => { api(`/api/jobs/${id}`).then((d) => setJob(d.job)).catch((e) => setError(e.message)); }, [id, user]);

  if (error) return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-ink-soft">{error}</div>;
  if (!job) return <div className="mx-auto max-w-3xl px-4 py-16"><div className="card h-64 animate-pulse" /></div>;
  const saved = savedIds.has(job.id);
  const cat = CATEGORY[job.category] || CATEGORY.private;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link href="/jobs" className="mb-6 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"><ArrowLeft size={16} /> Back to jobs</Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <article className="card rise p-6 sm:p-8">
          <div className="mb-3 flex flex-wrap gap-1.5">
            <span className={`chip ${cat.cls}`}>{cat.label}</span>
            {(job.tags || []).slice(0, 6).map((t) => <span key={t} className="chip bg-paper text-ink-soft">{t}</span>)}
          </div>
          <h1 className="font-display text-2xl font-bold leading-tight sm:text-3xl">{job.title}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
            {job.company && <span className="flex items-center gap-1.5"><Building2 size={15} />{job.company}</span>}
            {job.location && <span className="flex items-center gap-1.5"><MapPin size={15} />{job.location}</span>}
            {job.salary && <span className="flex items-center gap-1.5"><Wallet size={15} />{job.salary}</span>}
          </div>
          <hr className="my-6 border-line" />
          <div className="whitespace-pre-line text-[15px] leading-relaxed text-ink/90">{job.description || 'Open the original posting for full details.'}</div>
        </article>
        <aside className="space-y-4">
          <div className="card sticky top-24 p-5">
            {job.score != null && (
              <div className="mb-4 flex items-center gap-3 rounded-xl bg-paper p-3">
                <MatchRing score={job.score} />
                <div className="text-sm"><b>CV match</b><p className="text-ink-soft">{job.matchedSkills?.length || 0} of your skills found</p></div>
              </div>
            )}
            <div className="mb-4 space-y-2 text-sm">
              <div className="flex items-center gap-2"><CalendarDays size={16} className="text-ink-soft" />
                {job.deadline ? <span>Deadline <b>{fmtDate(job.deadline)}</b></span> : <span className="text-ink-soft">No deadline listed</span>}
              </div>
              <DeadlineBadge deadline={job.deadline} daysLeft={job.days_left} />
              <p className="text-xs text-ink-soft">via {SOURCE_LABEL[job.source] || job.source}{job.posted_at ? ` · posted ${timeAgo(job.posted_at)}` : ''}</p>
            </div>
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="btn-primary w-full">Apply on original site <ExternalLink size={15} /></a>
            {user ? (
              <button onClick={() => toggleSave(job.id)} className="btn-ghost mt-2 w-full">
                {saved ? <><BookmarkCheck size={16} className="text-brand" /> Saved — reminders on</> : <><Bookmark size={16} /> Save & remind me</>}
              </button>
            ) : (
              <Link href="/register" className="btn-ghost mt-2 w-full">Sign up to get a reminder</Link>
            )}
            <AiTools jobId={job.id} />
            {job.missingSkills?.length > 0 && (
              <div className="mt-5">
                <p className="label mb-2">Skills to highlight or learn</p>
                <div className="flex flex-wrap gap-1.5">{job.missingSkills.map((s) => <span key={s} className="chip border border-dashed border-line text-ink-soft">{s}</span>)}</div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
