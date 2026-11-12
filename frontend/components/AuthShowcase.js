'use client';
// The panel beside the sign-in / sign-up form. Instead of marketing copy it shows a worked
// example of what the product does: a consolidated government advertisement, with the one post
// that fits the CV picked out, followed by a short plain list of what members get.
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const POSTS = [
  ['Assistant Director (IT)', 'BPS-17', '4', 'BS Computer Science, 2 years experience', true],
  ['Accounts Officer', 'BPS-16', '6', 'B.Com / BBA (Finance)', false],
  ['Stenotypist', 'BPS-14', '12', 'Intermediate, shorthand 60 wpm', false],
];

const FEATURES = [
  ['Government, private and remote jobs together', 'FPSC, PPSC, KPPSC, SPSC, BPSC, NTS, PTS, newspaper ads, NGOs, UN agencies and international remote boards.'],
  ['Only jobs you are eligible for', 'Government posts are checked against your domicile. Remote jobs are checked against your country.'],
  ['The right post from a long advertisement', 'We read the official PDF and pick the post that fits your CV, with requirements and how to apply.'],
  ['Reminders before the last date', 'Save a job and we email you before applications close.'],
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
    <div className={compact ? '' : 'lg:pt-2'}>
      <h2 className={`font-display font-bold leading-tight tracking-tight text-ink ${compact ? 'text-xl' : 'text-[1.75rem] lg:text-[2rem]'}`}>
        Jobs in Pakistan and remote, filtered by your CV and sorted by last date.
      </h2>
      {stats && (
        <p className="tabular mt-3 text-sm text-ink-soft">
          {Number(stats.total || 0).toLocaleString()} open jobs right now, {Number(stats.govt || 0).toLocaleString()} of them government.{' '}
          {Number(stats.closing_week || 0).toLocaleString()} close this week.
        </p>
      )}

      {!compact && (
        <figure className="card mt-7 overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">Federal Public Service Commission</p>
              <p className="text-sm text-ink-soft">Consolidated Advertisement No. 9, 14 posts</p>
            </div>
            <div className="tabular shrink-0 rounded-[6px] border border-alert/40 bg-alert-tint px-2.5 py-1 text-center text-alert">
              <p className="text-[11px] font-medium">Last date</p>
              <p className="text-sm font-bold">5 days</p>
            </div>
          </div>
          <table className="w-full text-sm">
            <caption className="sr-only">Example advertisement with the post that matches a CV highlighted</caption>
            <tbody>
              {POSTS.map(([title, bps, seats, q, match]) => (
                <tr key={title} className={match ? 'bg-match-tint' : 'border-t border-line'}>
                  <td className={`py-3 pl-5 pr-3 align-top ${match ? 'border-l-[3px] border-match pl-[17px]' : ''}`}>
                    <p className={`font-medium ${match ? 'text-ink' : 'text-ink-soft'}`}>{title}</p>
                    <p className="text-xs text-ink-soft">{q}</p>
                  </td>
                  <td className="tabular whitespace-nowrap px-3 py-3 align-top text-ink-soft">{bps}<span className="block text-xs">{seats} seats</span></td>
                  <td className="py-3 pl-3 pr-5 text-right align-top">
                    {match ? <span className="tabular text-sm font-bold text-match">86%</span> : <span className="text-xs text-ink-soft">Not a fit</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <figcaption className="border-t border-line bg-paper px-5 py-3 text-xs text-ink-soft">
            Example. Your CV is compared with every post in the advertisement, and only the one that fits is shown in your matches.
          </figcaption>
        </figure>
      )}

      <dl className={`mt-7 grid gap-x-8 gap-y-5 ${compact ? '' : 'sm:grid-cols-2'}`}>
        {(compact ? FEATURES.slice(0, 3) : FEATURES).map(([t, d]) => (
          <div key={t} className="border-t border-line-strong pt-3">
            <dt className="text-sm font-semibold text-ink">{t}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-ink-soft">{d}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-7 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-[8px] border border-line bg-white px-4 py-3">
          <p className="font-semibold text-ink">Free</p>
          <p className="mt-0.5 text-ink-soft">Browse every job, see deadlines and get reminders for saved jobs.</p>
        </div>
        <div className="rounded-[8px] border border-brand/30 bg-brand-tint px-4 py-3">
          <p className="font-semibold text-brand-dark">Pro, {price} a month</p>
          <p className="mt-0.5 text-ink-soft">CV matching, full advertisement summaries and AI cover letters.</p>
        </div>
      </div>
    </div>
  );
}
