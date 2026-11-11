'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Sparkles, FileText, BellRing, Wand2, Check } from 'lucide-react';
import { api } from '@/lib/api';

export default function Paywall({ reason }) {
  const [plan, setPlan] = useState(null);
  useEffect(() => { api('/api/billing/plan', { auth: false }).then(setPlan).catch(() => {}); }, []);
  const expired = reason === 'expired';
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <div className="card rise overflow-hidden">
        <div className="grain p-8 sm:p-10">
          <span className="chip mb-4 bg-brand text-white"><Sparkles size={12} /> JobRadar Pro</span>
          <h1 className="font-display text-3xl font-bold leading-tight">{expired ? 'Your plan has ended — renew to keep matching' : 'Let your CV find the jobs for you'}</h1>
          <p className="mt-3 text-ink-soft">Browsing jobs, deadlines and saving jobs stay free. CV matching and AI tools are part of Pro.</p>
          <div className="mt-6 flex items-end gap-2">
            <span className="font-display text-5xl font-extrabold">Rs {plan ? plan.price_pkr.toLocaleString() : '1,000'}</span>
            <span className="mb-2 text-ink-soft">/ {plan?.plan_days || 30} days</span>
          </div>
          <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            {[
              [FileText, 'Upload your CV — skills, titles & experience read automatically'],
              [Sparkles, 'Every job scored against your CV, incl. LinkedIn & Indeed results'],
              [Wand2, 'AI fit analysis and cover letters for any job'],
              [BellRing, 'Daily email when matching jobs are about to close'],
            ].map(([Icon, t]) => <li key={t} className="flex gap-2.5"><Icon size={18} className="mt-0.5 shrink-0 text-brand" />{t}</li>)}
          </ul>
          <Link href="/billing" className="btn-primary mt-8 h-12 px-8 text-base">Pay with Easypaisa or JazzCash</Link>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft"><Check size={14} /> Activated as soon as your payment is verified — usually within a few hours.</p>
        </div>
      </div>
    </div>
  );
}
