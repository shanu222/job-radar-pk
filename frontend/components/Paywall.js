'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FileText, BellRing, Wand2, Check, ListFilter } from 'lucide-react';
import { api } from '@/lib/api';

export default function Paywall({ reason }) {
  const [plan, setPlan] = useState(null);
  useEffect(() => { api('/api/billing/plan', { auth: false }).then(setPlan).catch(() => {}); }, []);
  const expired = reason === 'expired';
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <div className="card overflow-hidden">
        <div className="p-8 sm:p-10">
          <p className="mb-2 text-sm font-semibold text-brand">JobRadar Pro</p>
          <h1 className="font-display text-3xl font-bold leading-tight">{expired ? 'Your plan has ended. Renew to keep matching.' : 'Let your CV find the jobs for you'}</h1>
          <p className="mt-3 text-ink-soft">Browsing jobs, deadlines and saving jobs stay free. CV matching and AI tools are part of Pro.</p>
          <div className="mt-6 flex items-end gap-2">
            <span className="tabular font-display text-4xl font-bold">Rs {plan ? plan.price_pkr.toLocaleString() : '1,000'}</span>
            <span className="mb-2 text-ink-soft">/ {plan?.plan_days || 30} days</span>
          </div>
          <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            {[
              [FileText, 'Upload your CV and we read your skills, titles and experience'],
              [ListFilter, 'Every job scored against your CV, including results from LinkedIn and Indeed'],
              [Wand2, 'AI fit analysis and cover letters for any job'],
              [BellRing, 'Daily email when matching jobs are about to close'],
            ].map(([Icon, t]) => <li key={t} className="flex gap-2.5"><Icon size={18} className="mt-0.5 shrink-0 text-ink-soft" />{t}</li>)}
          </ul>
          <Link href="/billing" className="btn-primary mt-8 h-12 px-8 text-base">Pay with Easypaisa, JazzCash or bank</Link>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft"><Check size={14} /> Activated as soon as your payment is verified, usually within a few hours.</p>
        </div>
      </div>
    </div>
  );
}
