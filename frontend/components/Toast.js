'use client';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { friendlyError } from '@/lib/errors';

const Ctx = createContext(null);
const STYLE = {
  success: ['border-brand/30', 'text-brand', CheckCircle2],
  error: ['border-danger/30', 'text-danger', AlertCircle],
  info: ['border-line', 'text-ink-soft', Info],
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const id = useRef(0);

  const dismiss = useCallback((k) => setItems((xs) => xs.filter((x) => x.k !== k)), []);
  const push = useCallback((type, message, ms) => {
    const k = ++id.current;
    setItems((xs) => [...xs.filter((x) => x.message !== message).slice(-2), { k, type, message }]);
    setTimeout(() => dismiss(k), ms ?? (type === 'error' ? 6000 : 3500));
  }, [dismiss]);

  const toast = {
    success: (m) => push('success', m),
    info: (m) => push('info', m),
    error: (e, fallback) => push('error', friendlyError(e, fallback)),
  };

  return (
    <Ctx.Provider value={toast}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[110] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-6 sm:items-end">
        {items.map(({ k, type, message }) => {
          const [border, color, Icon] = STYLE[type];
          return (
            <div key={k} role={type === 'error' ? 'alert' : 'status'}
              className={`rise pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border ${border} bg-white px-4 py-3 text-sm shadow-[0_12px_32px_-12px_rgba(11,31,23,.35)]`}>
              <Icon size={18} className={`mt-px shrink-0 ${color}`} />
              <p className="flex-1 text-ink">{message}</p>
              <button onClick={() => dismiss(k)} className="text-ink-soft hover:text-ink" aria-label="Dismiss"><X size={15} /></button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
