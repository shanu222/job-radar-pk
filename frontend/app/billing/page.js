'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Copy, Check, UploadCloud, Clock, CheckCircle2, XCircle, ShieldCheck, ImageIcon } from 'lucide-react';
import { api, fmtDate } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import RequireAuth from '@/components/RequireAuth';

const METHODS = {
  easypaisa: { name: 'Easypaisa', color: '#1fb04b', tint: 'bg-[#e9f8ee]' },
  jazzcash: { name: 'JazzCash', color: '#d11f2f', tint: 'bg-[#fdecee]' },
};
const STATUS = {
  pending: [Clock, 'Waiting for review', 'bg-amber-50 text-amber-800'],
  approved: [CheckCircle2, 'Approved', 'bg-brand-tint text-brand-dark'],
  rejected: [XCircle, 'Not verified', 'bg-danger-tint text-danger'],
};

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="rounded-lg p-1.5 text-ink-soft hover:bg-white hover:text-ink" title="Copy">{ok ? <Check size={15} className="text-brand" /> : <Copy size={15} />}</button>
  );
}

function Billing() {
  const { user, refreshUser } = useAuth();
  const [plan, setPlan] = useState(null);
  const [payments, setPayments] = useState([]);
  const [method, setMethod] = useState('easypaisa');
  const [form, setForm] = useState({ txn_id: '', sender_number: '' });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const input = useRef(null);

  const load = () => { api('/api/billing/payments').then((d) => setPayments(d.payments)).catch(() => {}); refreshUser(); };
  useEffect(() => { api('/api/billing/plan').then(setPlan); load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const pick = (f) => {
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) return setMsg({ err: 'Screenshot must be PNG, JPG or WEBP' });
    if (f.size > 4 * 1024 * 1024) return setMsg({ err: 'Screenshot must be under 4 MB' });
    setMsg(null); setFile(f); setPreview(URL.createObjectURL(f));
  };

  async function submit(e) {
    e.preventDefault();
    if (!file) return setMsg({ err: 'Attach the payment screenshot' });
    setBusy(true); setMsg(null);
    const fd = new FormData();
    fd.append('method', method); fd.append('txn_id', form.txn_id.trim()); fd.append('sender_number', form.sender_number.trim()); fd.append('screenshot', file);
    try {
      await api('/api/billing/payments', { method: 'POST', form: fd });
      setMsg({ ok: 'Payment submitted. We’ll verify it and email you — usually within a few hours.' });
      setForm({ txn_id: '', sender_number: '' }); setFile(null); setPreview('');
      load();
    } catch (err) { setMsg({ err: err.message }); } finally { setBusy(false); }
  }

  if (!plan) return <div className="mx-auto max-w-5xl px-4 py-16"><div className="card h-80 animate-pulse" /></div>;
  const acc = plan[method];
  const pending = payments.find((p) => p.status === 'pending');
  const a = user.access;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Billing</h1>
      <div className="mt-4 mb-8 flex flex-wrap items-center gap-3">
        {a.active
          ? <span className="chip bg-brand-tint px-3 py-1.5 text-sm text-brand-dark"><CheckCircle2 size={15} />
              {a.reason === 'paid' ? `Pro active until ${fmtDate(String(a.paid_until).slice(0, 10))}` : a.reason === 'free_for_all' ? 'CV matching is free for everyone right now' : a.reason === 'admin' ? 'Admin — full access' : 'You have free Pro access'}
            </span>
          : <span className="chip bg-paper px-3 py-1.5 text-sm text-ink-soft">{a.reason === 'expired' ? 'Your Pro plan has ended' : 'Free plan — CV matching locked'}</span>}
        {a.active && <Link href="/matches" className="text-sm font-semibold text-brand">Go to my matches →</Link>}
      </div>

      {plan.global_free ? null : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="card p-6 sm:p-7">
            <p className="label">Step 1</p>
            <h2 className="mt-1 font-display text-xl font-bold">Send Rs {plan.price_pkr.toLocaleString()} for {plan.plan_days} days</h2>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {Object.entries(METHODS).map(([k, m]) => (
                <button key={k} type="button" onClick={() => setMethod(k)}
                  className={`rounded-xl border-2 px-4 py-3 text-left font-semibold transition ${method === k ? 'border-ink bg-white' : 'border-line bg-paper text-ink-soft hover:border-ink/30'}`}>
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />{m.name}
                </button>
              ))}
            </div>
            {acc?.number ? (
              <div className={`mt-4 rounded-xl ${METHODS[method].tint} p-4`}>
                <div className="flex items-center justify-between"><span className="text-sm text-ink-soft">Account title</span><b>{acc.title || '—'}</b></div>
                <div className="mt-2 flex items-center justify-between"><span className="text-sm text-ink-soft">{METHODS[method].name} number</span>
                  <span className="flex items-center gap-1 font-mono text-lg font-bold tracking-wide">{acc.number}<CopyBtn text={acc.number} /></span></div>
                <div className="mt-2 flex items-center justify-between"><span className="text-sm text-ink-soft">Amount</span><b>Rs {plan.price_pkr.toLocaleString()}</b></div>
              </div>
            ) : <p className="mt-4 rounded-xl bg-paper p-4 text-sm text-ink-soft">{METHODS[method].name} details haven’t been added yet. Please choose the other method or check back soon.</p>}
            <ol className="mt-5 list-decimal space-y-1.5 pl-5 text-sm text-ink-soft">
              <li>Open your {METHODS[method].name} app → Send Money → {method === 'easypaisa' ? 'Easypaisa Account' : 'Mobile Account'}.</li>
              <li>Send exactly Rs {plan.price_pkr.toLocaleString()} to the number above.</li>
              <li>Take a screenshot of the success screen showing the <b>Transaction ID (TID)</b>.</li>
            </ol>
            {plan.payment_instructions && <p className="mt-4 whitespace-pre-line rounded-xl border border-line p-3 text-sm">{plan.payment_instructions}</p>}
          </section>

          <section className="card p-6 sm:p-7">
            <p className="label">Step 2</p>
            <h2 className="mt-1 font-display text-xl font-bold">Upload your payment proof</h2>
            {pending ? (
              <div className="mt-5 rounded-xl bg-amber-50 p-5 text-sm text-amber-900">
                <b>Payment under review.</b> TID {pending.txn_id} submitted {fmtDate(pending.created_at.slice(0, 10))}. We’ll email you once it’s verified.
              </div>
            ) : (
              <form onSubmit={submit} className="mt-5 space-y-4">
                <label className="block"><span className="mb-1.5 block text-sm font-medium">Transaction ID (TID)</span>
                  <input className="input font-mono uppercase" required pattern="[A-Za-z0-9\-]{6,32}" maxLength={32} value={form.txn_id} onChange={(e) => setForm({ ...form, txn_id: e.target.value })} placeholder="e.g. 41234567890" /></label>
                <label className="block"><span className="mb-1.5 block text-sm font-medium">Mobile number you paid from</span>
                  <input className="input" required inputMode="tel" pattern="(\+92|0)3[0-9]{9}" maxLength={13} value={form.sender_number} onChange={(e) => setForm({ ...form, sender_number: e.target.value })} placeholder="03001234567" /></label>
                <div>
                  <span className="mb-1.5 block text-sm font-medium">Screenshot</span>
                  <button type="button" onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
                    className="flex w-full items-center gap-4 rounded-xl border-2 border-dashed border-line bg-paper p-4 text-left hover:border-brand/50">
                    {preview ? <img src={preview} alt="" className="h-20 w-16 rounded-lg object-cover" /> : <span className="grid h-20 w-16 place-items-center rounded-lg bg-white text-ink-soft"><ImageIcon /></span>}
                    <span className="text-sm"><b>{file ? file.name : 'Choose screenshot'}</b><span className="block text-ink-soft">PNG, JPG or WEBP · max 4 MB</span></span>
                  </button>
                  <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pick(e.target.files[0])} />
                </div>
                {msg?.err && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{msg.err}</p>}
                <button disabled={busy} className="btn-primary h-11 w-full"><UploadCloud size={16} />{busy ? 'Submitting…' : 'Submit for verification'}</button>
                <p className="flex items-start gap-1.5 text-xs text-ink-soft"><ShieldCheck size={14} className="mt-px shrink-0" />Your screenshot is only visible to the JobRadar admin. Each Transaction ID can be used once.</p>
              </form>
            )}
            {msg?.ok && <p className="mt-4 rounded-lg bg-brand-tint px-3 py-2 text-sm text-brand-dark">{msg.ok}</p>}
          </section>
        </div>
      )}

      {payments.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-lg font-bold">Payment history</h2>
          <div className="card divide-y divide-line">
            {payments.map((p) => {
              const [Icon, label, cls] = STATUS[p.status];
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                  <span className={`chip ${cls}`}><Icon size={13} />{label}</span>
                  <span className="font-medium">{METHODS[p.method].name} · Rs {p.amount.toLocaleString()}</span>
                  <span className="font-mono text-ink-soft">TID {p.txn_id}</span>
                  <span className="ml-auto text-ink-soft">{fmtDate(p.created_at.slice(0, 10))}</span>
                  {p.status === 'rejected' && p.admin_note && <p className="w-full text-danger">Reason: {p.admin_note}</p>}
                  {p.status === 'approved' && p.days_granted && <p className="w-full text-ink-soft">{p.days_granted} days added</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export default function BillingPage() { return <RequireAuth title="Sign in to upgrade"><Billing /></RequireAuth>; }
