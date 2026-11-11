'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard, Wallet, Users, Settings, Database, ScrollText, CheckCircle2, XCircle, Clock, Search,
  Shield, Gift, Ban, RotateCcw, Loader2, Mail, Bot, Play, Eye, X,
} from 'lucide-react';
import { api, API, getToken, fmtDate } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import RequireAuth from '@/components/RequireAuth';

const TABS = [
  ['overview', 'Overview', LayoutDashboard], ['payments', 'Payments', Wallet], ['users', 'Users', Users],
  ['settings', 'Settings', Settings], ['data', 'Jobs data', Database], ['audit', 'Audit log', ScrollText],
];
const d10 = (s) => (s ? fmtDate(String(s).slice(0, 10)) : '—');
const isActive = (u) => u.role === 'admin' || u.is_free || (u.paid_until && new Date(u.paid_until) > new Date());

function Stat({ label, value, sub, tone }) {
  return (
    <div className="card p-5">
      <p className="label">{label}</p>
      <p className={`mt-2 font-display text-3xl font-bold ${tone || ''}`}>{value ?? '—'}</p>
      {sub && <p className="mt-1 text-xs text-ink-soft">{sub}</p>}
    </div>
  );
}

// ── Overview ────────────────────────────────────────────────────────────────
function Overview({ go }) {
  const [d, setD] = useState(null);
  useEffect(() => { api('/api/admin/overview').then(setD); }, []);
  if (!d) return <div className="card h-48 animate-pulse" />;
  return (
    <div className="space-y-6">
      {d.payments.pending > 0 && (
        <button onClick={() => go('payments')} className="flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left text-amber-900">
          <Clock size={20} /><b>{d.payments.pending} payment{d.payments.pending > 1 ? 's' : ''} waiting for review</b><span className="ml-auto text-sm font-semibold">Review →</span>
        </button>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Users" value={d.users.users} sub={`+${d.users.new_week} this week · ${d.users.with_cv} with CV`} />
        <Stat label="Paying now" value={d.users.paying} sub={`${d.users.free_users} on free access`} tone="text-brand" />
        <Stat label="Revenue this month" value={`Rs ${d.payments.revenue_month.toLocaleString()}`} sub={`Rs ${d.payments.revenue_total.toLocaleString()} all time`} />
        <Stat label="Live jobs" value={d.jobs.jobs.toLocaleString()} sub={`${d.jobs.jobs_today} added in 24h`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['Free for everyone', d.global_free ? 'ON' : 'Off', d.global_free],
          ['AI features', d.ai ? 'Connected' : 'Not set up', d.ai],
          ['Email sending', d.email ? 'Connected' : 'Not set up', d.email],
        ].map(([l, v, ok]) => (
          <div key={l} className="card flex items-center justify-between p-4 text-sm">
            <span>{l}</span><span className={`chip ${ok ? 'bg-brand-tint text-brand-dark' : 'bg-paper text-ink-soft'}`}>{v}</span>
          </div>
        ))}
      </div>
      <p className="text-sm text-ink-soft">JSearch credits this month: <b>{d.jsearch.used}</b> / {d.jsearch.cap}</p>
    </div>
  );
}

// ── Payments ────────────────────────────────────────────────────────────────
function Screenshot({ id, onClose }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let u = '';
    // Fetched with the admin token, then shown from memory — the image never has a public URL
    fetch(`${API}/api/admin/payments/${id}/screenshot`, { headers: { authorization: `Bearer ${getToken()}` } })
      .then((r) => r.blob()).then((b) => { u = URL.createObjectURL(b); setUrl(u); });
    return () => u && URL.revokeObjectURL(u);
  }, [id]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4" onClick={onClose}>
      <div className="relative max-h-[90vh] max-w-lg overflow-auto rounded-2xl bg-white p-2" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 rounded-full bg-white/90 p-1.5 shadow"><X size={16} /></button>
        {url ? <img src={url} alt="Payment screenshot" className="w-full rounded-xl" /> : <div className="grid h-64 w-64 place-items-center"><Loader2 className="animate-spin" /></div>}
      </div>
    </div>
  );
}

function Payments() {
  const [status, setStatus] = useState('pending');
  const [list, setList] = useState(null);
  const [shot, setShot] = useState(null);
  const [busy, setBusy] = useState(null);
  const [notes, setNotes] = useState({});
  const load = useCallback(() => { setList(null); api(`/api/admin/payments?status=${status}`).then((d) => setList(d.payments)); }, [status]);
  useEffect(load, [load]);

  const review = async (p, action) => {
    if (action === 'reject' && !notes[p.id]) { if (!confirm('Reject without a reason? The user will be emailed.')) return; }
    if (action === 'approve' && !confirm(`Approve TID ${p.txn_id} for ${p.email}?\n\nOnly approve after you see this ${p.method === 'bank' ? 'reference' : 'TID'} and Rs ${p.amount} in your ${{ easypaisa: 'Easypaisa app', jazzcash: 'JazzCash app', bank: 'HBL statement' }[p.method]}.`)) return;
    setBusy(p.id);
    try { await api(`/api/admin/payments/${p.id}/review`, { method: 'POST', body: { action, note: notes[p.id] || undefined } }); load(); }
    catch (e) { alert(e.message); } finally { setBusy(null); }
  };

  return (
    <div>
      <div className="mb-4 flex gap-1">
        {['pending', 'approved', 'rejected', ''].map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${status === s ? 'bg-ink text-white' : 'text-ink-soft hover:bg-white'}`}>{s ? s[0].toUpperCase() + s.slice(1) : 'All'}</button>
        ))}
      </div>
      {!list && <div className="card h-40 animate-pulse" />}
      {list?.length === 0 && <div className="card p-10 text-center text-ink-soft">No {status} payments.</div>}
      <div className="space-y-3">
        {list?.map((p) => (
          <div key={p.id} className="card p-5">
            <div className="flex flex-wrap items-start gap-4">
              <button onClick={() => setShot(p.id)} className="grid h-20 w-16 shrink-0 place-items-center rounded-lg border border-line bg-paper text-ink-soft hover:border-ink/40" title="View screenshot"><Eye size={18} /></button>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-display text-base font-semibold">{p.name || p.email}</p>
                <p className="text-ink-soft">{p.email}{p.approved_before ? ` · ${p.approved_before} previous payment${p.approved_before > 1 ? 's' : ''}` : ' · first payment'}</p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                  <span><b className={{ easypaisa: 'text-[#1fb04b]', jazzcash: 'text-[#d11f2f]', bank: 'text-brand' }[p.method]}>{{ easypaisa: 'Easypaisa', jazzcash: 'JazzCash', bank: 'Bank transfer' }[p.method]}</b> · Rs {p.amount.toLocaleString()}</span>
                  <span>{p.method === 'bank' ? 'Ref' : 'TID'} <b className="font-mono">{p.txn_id}</b></span>
                  <span>From {p.sender_number}</span>
                  <span className="text-ink-soft">{new Date(p.created_at).toLocaleString('en-GB')}</span>
                </div>
                {p.status !== 'pending' && <p className="mt-2 text-ink-soft">{p.status === 'approved' ? `Approved · ${p.days_granted} days · plan until ${d10(p.paid_until)}` : `Rejected${p.admin_note ? `: ${p.admin_note}` : ''}`}</p>}
              </div>
              {p.status === 'pending' && (
                <div className="flex w-full flex-col gap-2 sm:w-64">
                  <input className="input py-2" placeholder="Note to user (for rejection)" maxLength={500} value={notes[p.id] || ''} onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <button disabled={busy === p.id} onClick={() => review(p, 'approve')} className="btn-primary py-2"><CheckCircle2 size={15} />Approve</button>
                    <button disabled={busy === p.id} onClick={() => review(p, 'reject')} className="btn-ghost py-2 text-danger"><XCircle size={15} />Reject</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {shot && <Screenshot id={shot} onClose={() => setShot(null)} />}
    </div>
  );
}

// ── Users ───────────────────────────────────────────────────────────────────
function UsersTab() {
  const { user: me } = useAuth();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const load = useCallback(() => api(`/api/admin/users?q=${encodeURIComponent(q)}&filter=${filter}`).then(setData), [q, filter]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const patch = async (u, body, confirmMsg) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(u.id);
    try { await api(`/api/admin/users/${u.id}`, { method: 'PATCH', body }); await load(); }
    catch (e) { alert(e.message); } finally { setBusy(null); }
  };
  const extend = (u) => {
    const v = prompt(`Add how many days of Pro for ${u.email}? (negative to remove)`, '30');
    if (v && Number.isInteger(Number(v))) patch(u, { extend_days: Number(v) });
  };
  const del = async (u) => {
    if (!confirm(`Permanently delete ${u.email} and all their data? This cannot be undone.`)) return;
    try { await api(`/api/admin/users/${u.id}`, { method: 'DELETE' }); load(); } catch (e) { alert(e.message); }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input className="input pl-9" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All users</option><option value="paying">Paying</option><option value="free">Free access</option><option value="admins">Admins</option><option value="disabled">Suspended</option>
        </select>
      </div>
      <p className="mb-3 text-sm text-ink-soft">{data ? `${data.total} users` : 'Loading…'}</p>
      <div className="card divide-y divide-line">
        {data?.users.map((u) => (
          <div key={u.id} className={`flex flex-wrap items-center gap-3 p-4 text-sm ${u.disabled ? 'opacity-60' : ''}`}>
            <div className="min-w-[220px] flex-1">
              <p className="font-medium">{u.name || '—'} {u.role === 'admin' && <span className="chip ml-1 bg-ink text-white"><Shield size={11} />Admin</span>} {u.google && <span className="chip ml-1 bg-paper text-ink-soft">Google</span>}</p>
              <p className="text-ink-soft">{u.email}</p>
              <p className="mt-1 text-xs text-ink-soft">Joined {d10(u.created_at)} · last seen {d10(u.last_login)} · {u.has_cv ? 'CV uploaded' : 'no CV'}</p>
            </div>
            <div className="w-44 text-xs">
              {u.disabled ? <span className="chip bg-danger-tint text-danger">Suspended</span>
                : isActive(u) ? <span className="chip bg-brand-tint text-brand-dark">{u.role === 'admin' ? 'Admin' : u.is_free ? 'Free access' : `Pro until ${d10(u.paid_until)}`}</span>
                : <span className="chip bg-paper text-ink-soft">{u.paid_until ? `Expired ${d10(u.paid_until)}` : 'Free plan'}</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {busy === u.id ? <Loader2 size={16} className="animate-spin" /> : <>
                <button onClick={() => patch(u, { is_free: !u.is_free })} className={`btn-ghost px-2.5 py-1.5 text-xs ${u.is_free ? 'border-brand text-brand' : ''}`} title="Give / remove free Pro access"><Gift size={13} />{u.is_free ? 'Free ✓' : 'Make free'}</button>
                <button onClick={() => extend(u)} className="btn-ghost px-2.5 py-1.5 text-xs" title="Add or remove Pro days">+ Days</button>
                {u.id !== me.id && <>
                  <button onClick={() => patch(u, { disabled: !u.disabled }, u.disabled ? null : `Suspend ${u.email}? They will be signed out.`)} className="btn-ghost px-2.5 py-1.5 text-xs" title={u.disabled ? 'Restore' : 'Suspend'}>{u.disabled ? <RotateCcw size={13} /> : <Ban size={13} />}{u.disabled ? 'Restore' : 'Suspend'}</button>
                  <button onClick={() => patch(u, { role: u.role === 'admin' ? 'user' : 'admin' }, u.role === 'admin' ? `Remove admin rights from ${u.email}?` : `Make ${u.email} an ADMIN? They will be able to approve payments and change all settings.`)} className="btn-ghost px-2.5 py-1.5 text-xs"><Shield size={13} />{u.role === 'admin' ? 'Demote' : 'Make admin'}</button>
                  <button onClick={() => del(u)} className="btn-ghost px-2.5 py-1.5 text-xs text-danger">Delete</button>
                </>}
              </>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Settings ────────────────────────────────────────────────────────────────
// Defined at module level so inputs keep focus while typing
function Section({ title, children, onSave }) {
  return (
    <section className="card p-6">
      <h3 className="mb-4 font-display text-lg font-bold">{title}</h3>
      <div className="space-y-4">{children}</div>
      {onSave && <button onClick={onSave} className="btn-primary mt-5">Save</button>}
    </section>
  );
}

function SettingsTab() {
  const [s, setS] = useState(null);
  const [secrets, setSecrets] = useState({ ai: '', resend: '' });
  const [msg, setMsg] = useState(null);
  const [test, setTest] = useState({});
  useEffect(() => { api('/api/admin/settings').then((d) => setS(d.settings)); }, []);
  if (!s) return <div className="card h-64 animate-pulse" />;

  const save = async (patch) => {
    setMsg(null);
    try { const d = await api('/api/admin/settings', { method: 'PUT', body: patch }); setS(d.settings); setSecrets({ ai: '', resend: '' }); setMsg({ ok: 'Saved' }); setTimeout(() => setMsg(null), 2000); }
    catch (e) { setMsg({ err: e.message }); }
  };
  const runTest = async (kind) => {
    setTest({ [kind]: { busy: true } });
    try {
      const d = await api(`/api/admin/test/${kind}`, { method: 'POST' });
      if (kind === 'ai') setTest({ ai: { results: d.results } });
      else setTest({ [kind]: { ok: d.message } });
    }
    catch (e) { setTest({ [kind]: { err: e.message } }); }
  };
  const set = (k, v) => setS({ ...s, [k]: v });
  const keyStatus = (k) => (k.set ? <span className="chip bg-brand-tint text-brand-dark">Saved ••••{k.last4}</span> : <span className="chip bg-paper text-ink-soft">Not set</span>);

  return (
    <div className="space-y-6">
      {msg?.ok && <p className="fixed bottom-6 right-6 z-50 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg">{msg.ok}</p>}
      {msg?.err && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{msg.err}</p>}

      <Section title="Access & pricing">
        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl bg-paper p-4">
          <span><b className="text-sm">Make CV matching free for everyone</b><span className="block text-sm text-ink-soft">Turns off the paywall for all users (e.g. a launch promotion). Paid plans keep their dates.</span></span>
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[#0d6b45]" checked={s.global_free} onChange={(e) => save({ global_free: e.target.checked })} />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block"><span className="label">Price (Rs)</span><input type="number" min="0" className="input mt-2" value={s.price_pkr} onChange={(e) => set('price_pkr', Number(e.target.value))} /></label>
          <label className="block"><span className="label">Days per payment</span><input type="number" min="1" className="input mt-2" value={s.plan_days} onChange={(e) => set('plan_days', Number(e.target.value))} /></label>
          <label className="block"><span className="label">AI calls / user / day</span><input type="number" min="0" className="input mt-2" value={s.ai_daily_limit} onChange={(e) => set('ai_daily_limit', Number(e.target.value))} /></label>
        </div>
        <button onClick={() => save({ price_pkr: s.price_pkr, plan_days: s.plan_days, ai_daily_limit: s.ai_daily_limit })} className="btn-primary">Save</button>
      </Section>

      <Section title="Payment accounts" onSave={() => save({ easypaisa: s.easypaisa, jazzcash: s.jazzcash, bank: s.bank, payment_instructions: s.payment_instructions })}>
        {[['easypaisa', 'Easypaisa'], ['jazzcash', 'JazzCash']].map(([k, label]) => (
          <div key={k} className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="label">{label} account title</span><input className="input mt-2" value={s[k].title} onChange={(e) => set(k, { ...s[k], title: e.target.value })} placeholder="Name on the account" /></label>
            <label className="block"><span className="label">{label} number</span><input className="input mt-2 font-mono" value={s[k].number} onChange={(e) => set(k, { ...s[k], number: e.target.value })} placeholder="03XXXXXXXXX" /></label>
          </div>
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          {[['title', 'Bank account title'], ['bank', 'Bank'], ['accountNumber', 'Account number'], ['iban', 'IBAN'], ['branch', 'Branch']].map(([k, label]) => (
            <label key={k} className="block"><span className="label">{label}</span>
              <input className={`input mt-2 ${k === 'accountNumber' || k === 'iban' ? 'font-mono' : ''}`} value={s.bank[k] || ''} onChange={(e) => set('bank', { ...s.bank, [k]: e.target.value })} /></label>
          ))}
        </div>
        <label className="block"><span className="label">Extra instructions (optional)</span>
          <textarea className="input mt-2" rows={2} maxLength={1000} value={s.payment_instructions} onChange={(e) => set('payment_instructions', e.target.value)} placeholder="e.g. Payments are verified 9 AM – 9 PM" /></label>
      </Section>

      <Section title="AI">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="label">Provider</span>
            <select className="input mt-2" value={s.ai.provider} onChange={(e) => set('ai', { ...s.ai, provider: e.target.value })}>
              <option value="gemini">Google Gemini</option><option value="openrouter">OpenRouter</option><option value="openai">OpenAI or compatible (Groq, DeepSeek…)</option><option value="anthropic">Anthropic (Claude)</option>
            </select></label>
          <label className="block"><span className="label">Model (leave empty for default)</span>
            <input className="input mt-2 font-mono" value={s.ai.model} onChange={(e) => set('ai', { ...s.ai, model: e.target.value })} placeholder={{ gemini: 'gemini-2.5-flash', openrouter: 'meta-llama/llama-3.3-70b-instruct:free', openai: 'gpt-4.1-mini', anthropic: 'claude-haiku-5-5' }[s.ai.provider]} /></label>
        </div>
        {s.ai.provider === 'openai' && <label className="block"><span className="label">Base URL (only for non-OpenAI providers)</span>
          <input className="input mt-2 font-mono" value={s.ai.baseUrl} onChange={(e) => set('ai', { ...s.ai, baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" /></label>}
        <label className="block"><span className="label flex items-center gap-2">API key {keyStatus(s.ai.apiKey)}</span>
          <input type="password" autoComplete="off" className="input mt-2 font-mono" value={secrets.ai} onChange={(e) => setSecrets({ ...secrets, ai: e.target.value })} placeholder={s.ai.apiKey.set ? 'Leave empty to keep the saved key' : 'Paste your API key'} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#0d6b45]" checked={s.ai.enabled} onChange={(e) => set('ai', { ...s.ai, enabled: e.target.checked })} /> AI features enabled</label>
        <p className="text-xs text-ink-soft">Used for reading CVs, job fit checks and cover letters. A key saved here is tried first; keys set in Railway (Gemini, OpenRouter, OpenAI) are used automatically as fallbacks when a limit is reached. Keys never reach browsers.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => save({ ai: { provider: s.ai.provider, model: s.ai.model, baseUrl: s.ai.baseUrl || '', enabled: s.ai.enabled, apiKey: secrets.ai || undefined } })} className="btn-primary">Save</button>
          <button onClick={() => runTest('ai')} className="btn-ghost">{test.ai?.busy ? <Loader2 size={15} className="animate-spin" /> : <Bot size={15} />}Test AI</button>
          {s.ai.apiKey.set && <button onClick={() => confirm('Remove the saved AI key?') && save({ ai: { apiKey: '__clear__' } })} className="btn-ghost text-danger">Remove key</button>}
        </div>
        {test.ai?.results && (
          <div className="divide-y divide-line rounded-xl border border-line text-sm">
            {test.ai.results.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className={`chip ${r.ok ? 'bg-brand-tint text-brand-dark' : 'bg-danger-tint text-danger'}`}>{r.ok ? 'Working' : 'Failed'}</span>
                <span className="font-mono text-xs">{r.id}</span>
                <span className="ml-auto text-xs text-ink-soft">{r.ok ? `${(r.ms / 1000).toFixed(1)}s` : r.error}</span>
              </div>
            ))}
            <p className="px-3 py-2 text-xs text-ink-soft">Requests use the first working model in this order and switch automatically when one hits its limit.</p>
          </div>
        )}
        {test.ai?.err && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{test.ai.err}</p>}
      </Section>

      <Section title="Email (Resend)">
        <label className="block"><span className="label">Send payment notifications to</span>
          <input type="email" className="input mt-2" value={s.email.adminNotify} onChange={(e) => set('email', { ...s.email, adminNotify: e.target.value })} placeholder="you@gmail.com" /></label>
        <label className="block"><span className="label">From address</span>
          <input className="input mt-2" value={s.email.from} onChange={(e) => set('email', { ...s.email, from: e.target.value })} placeholder="JobRadar PK <alerts@yourdomain.com>" /></label>
        <label className="block"><span className="label flex items-center gap-2">Resend API key {keyStatus(s.email.resendApiKey)}</span>
          <input type="password" autoComplete="off" className="input mt-2 font-mono" value={secrets.resend} onChange={(e) => setSecrets({ ...secrets, resend: e.target.value })} placeholder={s.email.resendApiKey.set ? 'Leave empty to keep the saved key' : 're_…'} /></label>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => save({ email: { adminNotify: s.email.adminNotify, from: s.email.from, resendApiKey: secrets.resend || undefined } })} className="btn-primary">Save</button>
          <button onClick={() => runTest('email')} className="btn-ghost">{test.email?.busy ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}Send test email</button>
        </div>
        {test.email?.ok && <p className="rounded-lg bg-brand-tint px-3 py-2 text-sm text-brand-dark">{test.email.ok}</p>}
        {test.email?.err && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{test.email.err}</p>}
      </Section>
    </div>
  );
}

// ── Data ────────────────────────────────────────────────────────────────────
function DataTab() {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState('');
  const load = () => api('/api/admin/sources').then(setD);
  useEffect(() => { load(); }, []);
  const run = async (what) => {
    setBusy(what); setResult('');
    try { const r = await api(`/api/admin/${what}`, { method: 'POST' }); setResult(what === 'ingest' ? 'Import finished' : `Reminders sent: ${r.sent}`); load(); }
    catch (e) { setResult(e.message); } finally { setBusy(''); }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => run('ingest')} disabled={!!busy} className="btn-primary">{busy === 'ingest' ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}Import jobs now</button>
        <button onClick={() => run('reminders')} disabled={!!busy} className="btn-ghost">{busy === 'reminders' ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}Send reminder emails now</button>
        {result && <span className="self-center text-sm text-ink-soft">{result}</span>}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wider text-ink-soft"><tr><th className="p-3">Source</th><th className="p-3">Last run</th><th className="p-3">Fetched</th><th className="p-3">Saved</th><th className="p-3">Status</th></tr></thead>
          <tbody className="divide-y divide-line">
            {d?.sources.map((s) => (
              <tr key={s.name}><td className="p-3 font-medium">{s.label}</td>
                <td className="p-3 text-ink-soft">{s.last ? new Date(s.last.ran_at).toLocaleString('en-GB') : '—'}</td>
                <td className="p-3">{s.last?.fetched ?? '—'}</td><td className="p-3">{s.last?.upserted ?? '—'}</td>
                <td className="p-3">{!s.enabled ? <span className="chip bg-paper text-ink-soft">Needs key</span> : s.last?.error ? <span className="chip bg-danger-tint text-danger" title={s.last.error}>Error</span> : s.last?.fetched === 0 ? <span className="chip bg-amber-50 text-amber-800">0 jobs</span> : <span className="chip bg-brand-tint text-brand-dark">OK</span>}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {d && (
        <div className="card p-5">
          <h3 className="font-display font-semibold">Google Jobs (JSearch) searches from users’ CVs</h3>
          <p className="mt-1 text-sm text-ink-soft">Credits this month: <b>{d.jsearch.credits.used}</b> / {d.jsearch.credits.cap}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {d.jsearch.searches.length ? d.jsearch.searches.map((s) => <span key={s.q + s.remote} className="chip bg-paper text-ink-soft">{s.q}{s.users > 1 ? ` ×${s.users}` : ''}</span>) : <span className="text-sm text-ink-soft">No CVs uploaded yet.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function AuditTab() {
  const [log, setLog] = useState(null);
  useEffect(() => { api('/api/admin/audit').then((d) => setLog(d.log)); }, []);
  return (
    <div className="card divide-y divide-line text-sm">
      {!log && <div className="h-40 animate-pulse" />}
      {log?.length === 0 && <p className="p-8 text-center text-ink-soft">No admin actions yet.</p>}
      {log?.map((l) => (
        <div key={l.id} className="flex flex-wrap gap-x-4 gap-y-1 p-3">
          <span className="w-40 text-ink-soft">{new Date(l.created_at).toLocaleString('en-GB')}</span>
          <span className="font-mono font-medium">{l.action}</span>
          <span className="text-ink-soft">{l.target}</span>
          <span className="ml-auto text-ink-soft">{l.admin || 'admin key'}</span>
        </div>
      ))}
    </div>
  );
}

function AdminInner() {
  const { user } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const tab = sp.get('tab') || 'overview';
  const go = (t) => router.push(`/admin?tab=${t}`, { scroll: false });
  if (user.role !== 'admin') return <div className="mx-auto max-w-md px-4 py-24 text-center"><h1 className="font-display text-2xl font-bold">Admins only</h1></div>;
  const body = { payments: <Payments />, users: <UsersTab />, settings: <SettingsTab />, data: <DataTab />, audit: <AuditTab /> }[tab] || <Overview go={go} />;
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 flex items-center gap-2 font-display text-3xl font-bold"><Shield /> Admin</h1>
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {TABS.map(([k, l, Icon]) => (
            <button key={k} onClick={() => go(k)} className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium ${tab === k ? 'bg-ink text-white' : 'text-ink-soft hover:bg-white hover:text-ink'}`}><Icon size={16} />{l}</button>
          ))}
        </nav>
        <div className="min-w-0">{body}</div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return <RequireAuth title="Admin sign-in required"><Suspense><AdminInner /></Suspense></RequireAuth>;
}
