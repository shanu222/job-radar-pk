'use client';
// Non-blocking replacement for window.confirm / prompt / alert (those freeze the page and hurt responsiveness).
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

const Ctx = createContext(null);

export function DialogProvider({ children }) {
  const [d, setD] = useState(null);
  const [value, setValue] = useState('');
  const resolver = useRef(null);
  const inputRef = useRef(null);

  const open = useCallback((opts) => new Promise((resolve) => {
    resolver.current = resolve;
    setValue(opts.defaultValue ?? '');
    setD(opts);
  }), []);

  const close = (result) => { resolver.current?.(result); resolver.current = null; setD(null); };

  useEffect(() => {
    if (!d) return;
    const onKey = (e) => { if (e.key === 'Escape') close(d.kind === 'prompt' ? null : false); };
    window.addEventListener('keydown', onKey);
    setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  const api = {
    confirm: (opts) => open({ kind: 'confirm', ...(typeof opts === 'string' ? { message: opts } : opts) }),
    prompt: (opts) => open({ kind: 'prompt', ...opts }),
    alert: (opts) => open({ kind: 'alert', ...(typeof opts === 'string' ? { message: opts } : opts) }),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      {d && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" onMouseDown={() => close(d.kind === 'prompt' ? null : false)}>
          <form
            role="dialog" aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); close(d.kind === 'prompt' ? value : true); }}
            className="rise w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-2xl"
          >
            <div className="flex gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${d.danger ? 'bg-danger-tint text-danger' : 'bg-brand-tint text-brand'}`}>
                {d.danger ? <AlertTriangle size={20} /> : <Info size={20} />}
              </span>
              <div className="min-w-0 flex-1">
                {d.title && <h2 className="font-display text-lg font-bold">{d.title}</h2>}
                {d.message && <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{d.message}</p>}
                {d.kind === 'prompt' && (
                  <input ref={inputRef} className="input mt-3" type={d.type || 'text'} value={value} onChange={(e) => setValue(e.target.value)} placeholder={d.placeholder} />
                )}
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {d.kind !== 'alert' && <button type="button" onClick={() => close(d.kind === 'prompt' ? null : false)} className="btn-ghost">Cancel</button>}
              <button ref={d.kind === 'prompt' ? undefined : inputRef} className={d.danger ? 'btn bg-danger text-white hover:opacity-90' : 'btn-primary'}>{d.confirmLabel || 'OK'}</button>
            </div>
          </form>
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useDialog = () => useContext(Ctx);
