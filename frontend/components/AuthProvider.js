'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [savedIds, setSavedIds] = useState(new Set());

  const refreshSaved = useCallback(async () => {
    try { const { jobs } = await api('/api/me/saved'); setSavedIds(new Set(jobs.map((j) => j.id))); } catch { /* signed out */ }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('jr_token')) { setReady(true); return; }
    api('/api/auth/me')
      .then(({ user }) => { setUser(user); refreshSaved(); })
      .catch(() => localStorage.removeItem('jr_token'))
      .finally(() => setReady(true));
  }, [refreshSaved]);

  const signIn = (token, u) => { localStorage.setItem('jr_token', token); setUser(u); refreshSaved(); };
  const signOut = () => { localStorage.removeItem('jr_token'); setUser(null); setSavedIds(new Set()); };

  const toggleSave = async (id) => {
    const isSaved = savedIds.has(id);
    setSavedIds((s) => { const n = new Set(s); isSaved ? n.delete(id) : n.add(id); return n; });
    try { await api(`/api/me/saved/${id}`, { method: isSaved ? 'DELETE' : 'POST' }); }
    catch { refreshSaved(); }
  };

  return <Ctx.Provider value={{ user, setUser, ready, signIn, signOut, savedIds, toggleSave }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
