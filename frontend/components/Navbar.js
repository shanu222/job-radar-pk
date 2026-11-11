'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Radar, Menu, X, LogOut, Shield, Sparkles } from 'lucide-react';
import { useAuth } from './AuthProvider';

const LINKS = [
  ['/jobs', 'Browse jobs'],
  ['/deadlines', 'Deadlines'],
  ['/matches', 'My matches'],
  ['/saved', 'Tracker'],
];

export default function Navbar() {
  const path = usePathname();
  const { user, signOut, ready } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-mint"><Radar size={18} /></span>
          JobRadar<span className="text-brand">PK</span>
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${path.startsWith(href) ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink hover:bg-white'}`}>
              {label}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-2 md:flex">
          {ready && (user ? (
            <>
              {user.role === 'admin' && <Link href="/admin" className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${path.startsWith('/admin') ? 'bg-ink text-white' : 'text-ink hover:bg-white'}`}><Shield size={15} />Admin</Link>}
              {!user.access?.active && <Link href="/billing" className="chip bg-mint px-3 py-1.5 text-sm font-semibold text-ink hover:bg-brand hover:text-white"><Sparkles size={13} />Upgrade</Link>}
              <Link href="/profile" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-white">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-bold text-white">{(user.name || user.email)[0].toUpperCase()}</span>
                {user.name?.split(' ')[0] || 'Profile'}
              </Link>
              <button onClick={signOut} className="rounded-lg p-2 text-ink-soft hover:bg-white" title="Sign out"><LogOut size={16} /></button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">Sign in</Link>
              <Link href="/register" className="btn-primary">Get started</Link>
            </>
          ))}
        </div>
        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
      </nav>
      {open && (
        <div className="border-t border-line bg-paper px-4 py-3 md:hidden" onClick={() => setOpen(false)}>
          {[...LINKS, ...(user ? [['/profile', 'Profile & CV'], ['/billing', user.access?.active ? 'Billing' : 'Upgrade to Pro'], ...(user.role === 'admin' ? [['/admin', 'Admin panel']] : [])] : [['/login', 'Sign in'], ['/register', 'Create account']])].map(([href, label]) => (
            <Link key={href} href={href} className="block rounded-lg px-3 py-2.5 font-medium hover:bg-white">{label}</Link>
          ))}
          {user && <button onClick={signOut} className="block w-full rounded-lg px-3 py-2.5 text-left font-medium text-danger">Sign out</button>}
        </div>
      )}
    </header>
  );
}
