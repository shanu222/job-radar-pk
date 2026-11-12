'use client';
import Link from 'next/link';
import { Bookmark, BookmarkCheck, ExternalLink } from 'lucide-react';
import { CATEGORY, SOURCE_LABEL, timeAgo } from '@/lib/api';
import { useAuth } from './AuthProvider';
import { eligibilityLabel } from '@/lib/places';

const urgency = (d) => (d <= 1 ? 'danger' : d <= 7 ? 'alert' : 'calm');

/** Text badge for deadlines (detail pages, tracker, timelines). */
export function DeadlineBadge({ deadline, daysLeft }) {
  if (!deadline) return <span className="text-sm text-ink-soft">Open until filled</span>;
  const d = Number(daysLeft);
  const u = urgency(d);
  const cls = u === 'danger' ? 'text-danger' : u === 'alert' ? 'text-alert' : 'text-ink-soft';
  const txt = d === 0 ? 'Closes today' : d === 1 ? 'Closes tomorrow' : `${d} days left`;
  return <span className={`text-sm font-semibold ${cls}`} title={`Last date ${deadline}`}>{txt}</span>;
}

/**
 * The "last date" block: the deadline set like the date on an advertisement.
 * Colour appears only when the deadline is close.
 */
export function LastDate({ deadline, daysLeft, size = 'md' }) {
  const box = size === "sm" ? "w-14 py-1.5 self-start" : "w-[68px] py-2 self-start";
  if (!deadline) {
    return (
      <div className={`${box} shrink-0 rounded-[6px] border border-line bg-paper text-center`} title="No closing date given">
        <p className="text-[11px] font-medium text-ink-soft">Closes</p>
        <p className="text-sm font-semibold text-ink-soft">Open</p>
      </div>
    );
  }
  const dt = new Date(`${deadline}T00:00:00`);
  const d = Number(daysLeft);
  const u = urgency(d);
  const tone = u === 'danger' ? 'border-danger/40 bg-danger-tint text-danger' : u === 'alert' ? 'border-alert/40 bg-alert-tint text-alert' : 'border-line bg-white text-ink';
  const sub = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `${d} days`;
  return (
    <div className={`${box} tabular shrink-0 rounded-[6px] border text-center ${tone}`} title={`Last date to apply: ${dt.toDateString()}`}>
      <p className="text-[11px] font-medium opacity-80">{dt.toLocaleDateString('en-GB', { month: 'short' })}</p>
      <p className={`${size === 'sm' ? 'text-lg' : 'text-2xl'} font-bold leading-none`}>{dt.getDate()}</p>
      <p className="mt-1 text-[11px] font-semibold">{sub}</p>
    </div>
  );
}

/** Match score: a plain number with a short bar, green only when it's a strong fit. */
export function MatchRing({ score }) {
  const strong = score >= 70;
  return (
    <div className="w-16 shrink-0" title={`${score}% match with your CV`}>
      <p className={`tabular text-lg font-bold leading-none ${strong ? 'text-match' : 'text-ink'}`}>{score}%</p>
      <div className="mt-1.5 h-1 rounded-full bg-line"><div className={`h-1 rounded-full ${strong ? 'bg-match' : 'bg-ink-soft'}`} style={{ width: `${score}%` }} /></div>
      <p className="mt-1 text-[11px] text-ink-soft">CV match</p>
    </div>
  );
}

/** One job as a row in a listing. Use inside <JobList>. */
export default function JobCard({ job }) {
  const { savedIds, toggleSave } = useAuth();
  const saved = savedIds.has(job.id);
  const cat = CATEGORY[job.category] || CATEGORY.private;
  const post = job.matched_position && !job.matched_position.single && job.matched_position.title ? job.matched_position : null;
  const who = eligibilityLabel(job);
  const meta = [cat.label, job.is_remote && job.category !== 'remote' ? 'Remote' : null, who].filter(Boolean);

  const actions = (
    <div className="-mr-2 flex gap-1">
      <button onClick={() => toggleSave(job.id)} aria-pressed={saved}
        className={`rounded-[6px] p-2 transition-colors ${saved ? 'text-brand' : 'text-ink-soft hover:bg-paper hover:text-ink'}`}
        title={saved ? 'Saved. You’ll get a reminder before it closes' : 'Save and remind me before it closes'}>
        {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
        <span className="sr-only">{saved ? 'Saved' : 'Save'}</span>
      </button>
      <a href={job.url} target="_blank" rel="noopener noreferrer" className="rounded-[6px] p-2 text-ink-soft hover:bg-paper hover:text-ink" title="Open the original advertisement">
        <ExternalLink size={18} /><span className="sr-only">Open original</span>
      </a>
    </div>
  );

  return (
    <article className="group relative flex gap-3 px-4 sm:gap-4 py-5 transition-colors hover:bg-[#f9fafb] sm:px-5">
      <div className="sm:hidden"><LastDate deadline={job.deadline} daysLeft={job.days_left} size="sm" /></div>
      <div className="hidden sm:block"><LastDate deadline={job.deadline} daysLeft={job.days_left} /></div>
      <div className="min-w-0 flex-1 break-words">
        <Link href={`/jobs/${job.id}`} className="text-base font-semibold sm:text-[17px] leading-snug text-ink after:absolute after:inset-0 group-hover:text-brand">
          {post ? post.title : job.title}
        </Link>
        {post && <p className="mt-0.5 line-clamp-1 text-sm text-ink-soft">Post in {job.title}</p>}
        <p className="mt-1 text-sm text-ink">
          {job.company}{job.company && job.location ? ', ' : ''}<span className="text-ink-soft">{job.location}</span>
        </p>
        {post && (post.bps || post.count || post.qualification) && (
          <p className="mt-2 text-sm text-ink">
            {[post.bps, post.count ? `${post.count} seat${post.count > 1 ? 's' : ''}` : null].filter(Boolean).join(', ')}
            {post.qualification && <span className="text-ink-soft">{post.bps || post.count ? '. ' : ''}{post.qualification}</span>}
          </p>
        )}
        {(job.summary || job.snippet) && <p className="mt-2 line-clamp-2 max-w-[70ch] text-sm leading-relaxed text-ink-soft">{job.summary || job.snippet}</p>}
        {job.matchedSkills?.length > 0 && (
          <p className="mt-2 text-sm">
            <span className="text-ink-soft">You have: </span>
            <span className="font-medium text-match">{job.matchedSkills.slice(0, 6).join(', ')}</span>
            {job.missingSkills?.length > 0 && <><span className="text-ink-soft"> &nbsp;Also asks for: </span><span className="text-ink">{job.missingSkills.slice(0, 3).join(', ')}</span></>}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
          {meta.map((m) => <span key={m}>{m}</span>)}
          <span>From {SOURCE_LABEL[job.source] || job.source}</span>
          {job.posted_at && <span>Posted {timeAgo(job.posted_at)}</span>}
          {job.salary && <span>{job.salary}</span>}
        </div>
        <div className="relative z-10 mt-2 flex items-center justify-between sm:hidden">
          {job.score != null ? <span className={`tabular text-sm font-bold ${job.score >= 70 ? 'text-match' : 'text-ink'}`}>{job.score}% CV match</span> : <span />}
          {actions}
        </div>
      </div>
      <div className="relative z-10 hidden shrink-0 flex-col items-end justify-between gap-3 sm:flex">
        {job.score != null ? <MatchRing score={job.score} /> : <span />}
        {actions}
      </div>
    </article>
  );
}

/** A listing: one bordered panel with rows separated by dividers. */
export function JobList({ children }) {
  return <div className="card divide-y divide-line overflow-hidden">{children}</div>;
}

export function JobSkeleton() {
  return (
    <div className="flex animate-pulse gap-4 px-5 py-5">
      <div className="h-[74px] w-[68px] rounded-[6px] bg-paper" />
      <div className="flex-1 space-y-2.5 pt-1">
        <div className="h-4 w-2/3 rounded bg-paper" />
        <div className="h-3.5 w-1/3 rounded bg-paper" />
        <div className="h-3.5 w-5/6 rounded bg-paper" />
      </div>
    </div>
  );
}
