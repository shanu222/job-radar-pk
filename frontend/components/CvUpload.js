'use client';
import { useRef, useState } from 'react';
import { UploadCloud, FileCheck2, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from './AuthProvider';

export default function CvUpload({ onDone, compact }) {
  const { user, setUser } = useAuth();
  const input = useRef(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function upload(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError('File is larger than 5 MB.');
    setBusy(true); setError('');
    const form = new FormData();
    form.append('cv', file);
    try {
      const { user, searching } = await api('/api/me/cv', { method: 'POST', form });
      setUser(user);
      onDone?.(user, searching);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <div>
      <button type="button" onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files[0]); }}
        className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center transition ${compact ? 'p-5' : 'p-10'} ${drag ? 'border-brand bg-brand-tint' : 'border-line bg-white hover:border-brand/50'}`}>
        {busy ? <Loader2 className="mb-3 animate-spin text-brand" size={32} /> : user?.has_cv ? <FileCheck2 className="mb-3 text-brand" size={32} /> : <UploadCloud className="mb-3 text-brand" size={32} />}
        <p className="font-display font-semibold">{busy ? 'Reading your CV…' : user?.has_cv ? 'Replace your CV' : 'Drop your CV here or click to upload'}</p>
        <p className="mt-1 text-sm text-ink-soft">PDF, DOCX or TXT · up to 5 MB</p>
      </button>
      <input ref={input} type="file" accept=".pdf,.docx,.txt" hidden onChange={(e) => upload(e.target.files[0])} />
      {error && <p className="mt-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
