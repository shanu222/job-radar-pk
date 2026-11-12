'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarPlus, Trash2, ExternalLink } from 'lucide-react';
import { api, API, getToken, fmtDate } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import RequireAuth from '@/components/RequireAuth';
import { DeadlineBadge } from '@/components/JobCard';

const STATUSES = [
  ['saved', 'To apply', 'bg-paper text-ink'], ['applied', 'Applied', 'bg-sky-50 text-sky-800'],
  ['interview', 'Interview', 'bg-violet-50 text-violet-800'], ['offer', 'Offer', 'bg-brand-tint text-brand-dark'], ['rejected', 'Not selected', 'bg-danger-tint text-danger'],
];

function Tracker() {
  const { toggleSave } = useAuth();
  const [jobs, setJobs] = useState(null);
  const [filter, setFilter] = useState('');
  useEffect(() => { api('/api/me/saved').then((d) => setJobs(d.jobs)); }, []);

  const setStatus = async (id, status) => {
    setJobs((js) => js.map((j) => (j.id === id ? { ...j, status } : j)));
    await api(`/api/me/saved/${id}`, { method: 'PATCH', body: { status } });
  };
  const remove = async (id) => { setJobs((js) => js.filter((j) => j.id !== id)); await toggleSave(id); };

  const calUrl = `${API}/api/me/saved/calendar.ics?token=${getToken()}`;
  const shown = jobs?.filter((j) => !filter || j.status === filter) || [];
  const counts = Object.fromEntries(STATUSES.map(([k]) => [k, jobs?.filter((j) => j.status === k).length || 0]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Application tracker</h1>
          <p className="mt-1 text-ink-soft">Saved jobs get an email reminder before they close.</p>
        </div>
        <a href={calUrl} className="btn-ghost"><CalendarPlus size={16} /> Add deadlines to my calendar</a>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {STATUSES.map(([k, l, cls]) => (
          <button key={k} onClick={() => setFilter(filter === k ? '' : k)} className={`card p-4 text-left transition ${filter === k ? 'ring-2 ring-ink' : 'hover:border-ink/30'}`}>
            <span className={`chip ${cls}`}>{l}</span>
            <p className="mt-2 font-display text-2xl font-bold">{counts[k]}</p>
          </button>
        ))}
      </div>
      {!jobs && <div className="card h-48 animate-pulse" />}
      {jobs?.length === 0 && (
        <div className="card p-12 text-center">
          <p className="font-display text-lg font-semibold">Nothing saved yet</p>
          <p className="mt-1 text-sm text-ink-soft">Tap the bookmark on any job to track it here.</p>
          <Link href="/matches" className="btn-primary mt-5">See my matches</Link>
        </div>
      )}
      {shown.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="hidden bg-paper text-left text-xs font-semibold text-ink-soft sm:table-header-group">
              <tr><th className="p-4">Job</th><th className="p-4">Deadline</th><th className="p-4">Status</th><th className="p-4" /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((j) => (
                <tr key={j.id} className="flex flex-col gap-2 p-4 sm:table-row sm:p-0">
                  <td className="sm:p-4">
                    <Link href={`/jobs/${j.id}`} className="font-medium hover:text-brand">{j.title}</Link>
                    <p className="text-ink-soft">{j.company}</p>
                  </td>
                  <td className="sm:p-4">
                    {j.deadline ? <div className="flex flex-col gap-1"><span>{fmtDate(j.deadline)}</span><DeadlineBadge deadline={j.deadline} daysLeft={j.days_left} /></div> : <span className="text-ink-soft">—</span>}
                  </td>
                  <td className="sm:p-4">
                    <select value={j.status} onChange={(e) => setStatus(j.id, e.target.value)} className="input w-auto py-1.5">
                      {STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </td>
                  <td className="whitespace-nowrap sm:p-4 sm:text-right">
                    <a href={j.url} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-[6px] p-2 text-ink-soft hover:bg-paper"><ExternalLink size={16} /></a>
                    <button onClick={() => remove(j.id)} className="rounded-[6px] p-2 text-ink-soft hover:bg-danger-tint hover:text-danger"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SavedPage() { return <RequireAuth title="Sign in to track your applications"><Tracker /></RequireAuth>; }
