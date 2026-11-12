'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, MapPin, CalendarDays, ExternalLink, Bookmark, BookmarkCheck, Wallet, Loader2, ListChecks, ClipboardList, Send, Users, ChevronDown } from 'lucide-react';
import { api, CATEGORY, SOURCE_LABEL, fmtDate, timeAgo } from '@/lib/api';
import { DeadlineBadge, MatchRing } from '@/components/JobCard';
import { useAuth } from '@/components/AuthProvider';
import AiTools from '@/components/AiTools';
import { eligibilityLabel } from '@/lib/places';

function Section({ icon: Icon, title, children }) {
  return (
    <section className="mb-7">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold"><Icon size={18} className="text-brand" />{title}</h2>
      {children}
    </section>
  );
}
const Bullets = ({ items }) => <ul className="space-y-1.5 text-[15px] leading-relaxed text-ink/90">{items.map((x) => <li key={x} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />{x}</li>)}</ul>;

function Details({ job }) {
  const d = job.details && !job.details.error ? job.details : null;
  const [showAd, setShowAd] = useState(false);
  const mp = job.matched_position;
  const raw = <div className="whitespace-pre-line text-[15px] leading-relaxed text-ink/90">{job.description || 'Open the original posting for full details.'}</div>;
  if (!d) {
    return (
      <>
        {job.details_pending && (
          <p className="mb-5 flex items-center gap-2 rounded-xl bg-paper px-4 py-3 text-sm text-ink-soft"><Loader2 size={16} className="animate-spin text-brand" />Reading the full advertisement — requirements and how to apply will appear here in a moment.</p>
        )}
        {raw}
      </>
    );
  }
  const posts = d.positions || [];
  return (
    <div>
      {d.summary && <p className="mb-7 text-[16px] leading-relaxed">{d.summary}</p>}
      {mp && posts.length > 1 && (
        <div className="mb-7 rounded-2xl border-2 border-brand/30 bg-brand-tint/40 p-5">
          <p className="label text-brand-dark">The post that fits your CV</p>
          <p className="mt-1 font-display text-lg font-bold">{mp.title}{mp.bps ? ` (${mp.bps})` : ''}</p>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {[['Posts', mp.count], ['Qualification', mp.qualification], ['Experience', mp.experience], ['Age limit', mp.age_limit], ['Quota / domicile', mp.domicile_quota], ['Pay', mp.salary]].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className={k === 'Qualification' ? 'sm:col-span-2' : ''}><dt className="inline text-ink-soft">{k}: </dt><dd className="inline">{v}</dd></div>
            ))}
          </dl>
        </div>
      )}
      {posts.length > 1 && (
        <Section icon={Users} title={`Posts in this advertisement (${posts.length})`}>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-paper text-left text-xs uppercase tracking-wider text-ink-soft"><tr><th className="p-3">Post</th><th className="p-3">Scale</th><th className="p-3">Seats</th><th className="p-3">Qualification</th></tr></thead>
              <tbody className="divide-y divide-line">
                {posts.map((p, i) => (
                  <tr key={i} className={mp && p.title === mp.title ? 'bg-brand-tint/50 font-medium' : ''}>
                    <td className="p-3">{p.title}</td><td className="p-3">{p.bps || '—'}</td><td className="p-3">{p.count ?? '—'}</td><td className="p-3 text-ink-soft">{p.qualification || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      {posts.length === 1 && (posts[0].qualification || posts[0].experience || posts[0].age_limit) && (
        <dl className="mb-7 grid gap-x-6 gap-y-1 rounded-xl bg-paper p-4 text-sm sm:grid-cols-2">
          {[['Scale', posts[0].bps], ['Posts', posts[0].count], ['Qualification', posts[0].qualification], ['Experience', posts[0].experience], ['Age limit', posts[0].age_limit], ['Quota / domicile', posts[0].domicile_quota], ['Pay', posts[0].salary]].filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className={k === 'Qualification' ? 'sm:col-span-2' : ''}><dt className="inline text-ink-soft">{k}: </dt><dd className="inline">{v}</dd></div>
          ))}
        </dl>
      )}
      {d.requirements?.length > 0 && <Section icon={ListChecks} title="Requirements"><Bullets items={d.requirements} /></Section>}
      {d.responsibilities?.length > 0 && <Section icon={ClipboardList} title="What you’ll do"><Bullets items={d.responsibilities} /></Section>}
      {(d.how_to_apply?.length > 0 || d.apply_url) && (
        <Section icon={Send} title="How to apply">
          {d.how_to_apply?.length > 0 && <ol className="list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink/90">{d.how_to_apply.map((x) => <li key={x}>{x}</li>)}</ol>}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {d.test_service && <span><span className="text-ink-soft">Test by: </span><b>{d.test_service}</b></span>}
            {d.fee && <span><span className="text-ink-soft">Fee: </span><b>{d.fee}</b></span>}
            {d.applicant_location && <span><span className="text-ink-soft">Applicants from: </span><b>{d.applicant_location}</b></span>}
          </div>
          {d.apply_url && <a href={d.apply_url} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4">Apply now <ExternalLink size={15} /></a>}
        </Section>
      )}
      <button onClick={() => setShowAd(!showAd)} className="mt-2 flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">
        <ChevronDown size={16} className={`transition ${showAd ? 'rotate-180' : ''}`} />{showAd ? 'Hide' : 'Show'} the original listing text
      </button>
      {showAd && <div className="mt-4 rounded-xl bg-paper p-4">{raw}</div>}
      <p className="mt-6 text-xs text-ink-soft">Details were read from the advertisement{d.method === 'ai' ? ' with AI' : ''} and may contain mistakes — always confirm on the official ad before applying.</p>
    </div>
  );
}

export default function JobDetail({ params }) {
  const { id } = use(params);
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const { user, savedIds, toggleSave } = useAuth();

  useEffect(() => {
    let stop = false, tries = 0, timer;
    const load = () => api(`/api/jobs/${id}`).then((d) => {
      if (stop) return;
      setJob(d.job);
      // The full advertisement is being read in the background — check again shortly
      if (d.job.details_pending && tries++ < 12) timer = setTimeout(load, 4000);
    }).catch((e) => !stop && setError(e.message));
    load();
    return () => { stop = true; clearTimeout(timer); };
  }, [id, user]);

  if (error) return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-ink-soft">{error}</div>;
  if (!job) return <div className="mx-auto max-w-3xl px-4 py-16"><div className="card h-64 animate-pulse" /></div>;
  const saved = savedIds.has(job.id);
  const cat = CATEGORY[job.category] || CATEGORY.private;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link href="/jobs" className="mb-6 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"><ArrowLeft size={16} /> Back to jobs</Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <article className="card rise min-w-0 break-words p-6 sm:p-8">
          <div className="mb-3 flex flex-wrap gap-1.5">
            <span className={`chip ${cat.cls}`}>{cat.label}</span>
            {(job.tags || []).filter((t) => t.toLowerCase() !== cat.label.toLowerCase() && !t.startsWith('search:')).slice(0, 6).map((t) => <span key={t} className="chip bg-paper text-ink-soft">{t}</span>)}
          </div>
          <h1 className="font-display text-2xl font-bold leading-tight sm:text-3xl">{job.title}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
            {job.company && <span className="flex items-center gap-1.5"><Building2 size={15} />{job.company}</span>}
            {job.location && <span className="flex items-center gap-1.5"><MapPin size={15} />{job.location}</span>}
            {job.salary && <span className="flex items-center gap-1.5"><Wallet size={15} />{job.salary}</span>}
          </div>
          <hr className="my-6 border-line" />
          <Details job={job} />
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
              {eligibilityLabel(job) && <p className="text-sm"><span className="text-ink-soft">Who can apply: </span><b>{eligibilityLabel(job)}</b></p>}
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
