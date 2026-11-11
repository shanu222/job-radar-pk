'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wand2, FileSignature, Copy, Check, RefreshCw, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from './AuthProvider';

// Minimal, safe Markdown → React (bold + bullet lists + paragraphs). Never uses innerHTML.
function Md({ text }) {
  const inline = (s, k) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <b key={`${k}-${i}`}>{p.slice(2, -2)}</b> : p));
  const blocks = [];
  let list = [];
  const flush = () => { if (list.length) { blocks.push(<ul key={blocks.length} className="mb-3 list-disc space-y-1 pl-5">{list}</ul>); list = []; } };
  text.split('\n').forEach((line, i) => {
    const t = line.trim();
    if (/^[-*•]\s+/.test(t)) list.push(<li key={i}>{inline(t.replace(/^[-*•]\s+/, ''), i)}</li>);
    else { flush(); if (t) blocks.push(<p key={`p${i}`} className="mb-2">{inline(t.replace(/^#+\s*/, ''), i)}</p>); }
  });
  flush();
  return <div className="text-sm leading-relaxed text-ink/90">{blocks}</div>;
}

export default function AiTools({ jobId }) {
  const { user } = useAuth();
  const [available, setAvailable] = useState(null);
  const [out, setOut] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (user) api('/api/me/ai/status').then((d) => setAvailable(d.available)).catch(() => setAvailable(false)); }, [user]);

  if (!user || available === false) return null;
  if (!user.access?.active) return (
    <div className="mt-5 border-t border-line pt-5 text-sm">
      <p className="flex items-center gap-2 font-display font-semibold"><Wand2 size={16} className="text-brand" /> AI fit check & cover letter</p>
      <p className="mt-1 text-ink-soft">See how well you fit this job and get a tailored cover letter.</p>
      <Link href="/billing" className="btn-primary mt-3 w-full">Unlock with Pro</Link>
    </div>
  );
  if (!user.has_cv) return null;

  const run = async (kind, refresh = false) => {
    setBusy(kind); setError('');
    try { const d = await api(`/api/me/ai/${kind}/${jobId}${refresh ? '?refresh=true' : ''}`, { method: 'POST' }); setOut((o) => ({ ...o, [kind]: d.content })); }
    catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  return (
    <div className="mt-5 border-t border-line pt-5">
      <p className="mb-3 flex items-center gap-2 font-display font-semibold"><Wand2 size={16} className="text-brand" /> AI tools</p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => run('insight')} disabled={!!busy} className="btn-ghost text-xs">{busy === 'insight' ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}Fit check</button>
        <button onClick={() => run('cover_letter')} disabled={!!busy} className="btn-ghost text-xs">{busy === 'cover_letter' ? <Loader2 size={14} className="animate-spin" /> : <FileSignature size={14} />}Cover letter</button>
      </div>
      {error && <p className="mt-3 rounded-lg bg-danger-tint px-3 py-2 text-xs text-danger">{error}</p>}
      {out.insight && (
        <div className="mt-4 rounded-xl bg-paper p-4">
          <div className="mb-2 flex items-center justify-between"><span className="label">Fit check</span>
            <button onClick={() => run('insight', true)} className="text-ink-soft hover:text-ink" title="Regenerate"><RefreshCw size={13} /></button></div>
          <Md text={out.insight} />
        </div>
      )}
      {out.cover_letter && (
        <div className="mt-4 rounded-xl bg-paper p-4">
          <div className="mb-2 flex items-center justify-between"><span className="label">Cover letter</span>
            <span className="flex gap-2">
              <button onClick={() => { navigator.clipboard?.writeText(out.cover_letter); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-ink-soft hover:text-ink" title="Copy">{copied ? <Check size={13} /> : <Copy size={13} />}</button>
              <button onClick={() => run('cover_letter', true)} className="text-ink-soft hover:text-ink" title="Regenerate"><RefreshCw size={13} /></button>
            </span></div>
          <p className="whitespace-pre-line text-sm leading-relaxed">{out.cover_letter}</p>
        </div>
      )}
      <p className="mt-3 text-[11px] text-ink-soft">AI can make mistakes — check before sending.</p>
    </div>
  );
}
