'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Radar, Menu, X, LogOut, Shield } from 'lucide-react';
import { useAuth } from './AuthProvider';

const LINKS = [
  ['/jobs', 'Browse jobs'],
  ['/deadlines', 'Deadlines'],
  ['/matches', 'My matches'],
  ['/saved', 'Tracker'],
];

export default function Navbar() {
  const path = usePathname();
  const { user, signOut: doSignOut, ready } = useAuth();
  const router = useRouter();
  const signOut = () => { doSignOut(); router.replace('/'); };
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-white">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href={user ? '/jobs' : '/'} className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-[6px] bg-brand text-white"><Radar size={18} /></span>
          JobRadar PK
        </Link>
        <div className={`hidden items-center gap-1 ${user ? 'md:flex' : ''}`}>
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href}
              className={`rounded-[6px] px-3 py-2 text-sm font-medium transition ${path.startsWith(href) ? 'bg-brand-tint text-brand-dark' : 'text-ink-soft hover:text-ink hover:bg-white'}`}>
              {label}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-2 md:flex">
          {ready && (user ? (
            <>
              {user.role === 'admin' && <Link href="/admin" className={`flex items-center gap-1.5 rounded-[6px] px-3 py-2 text-sm font-semibold ${path.startsWith('/admin') ? 'bg-brand-tint text-brand-dark' : 'text-ink hover:bg-white'}`}><Shield size={15} />Admin</Link>}
              {!user.access?.active && <Link href="/billing" className="rounded-[6px] border border-brand/40 px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand-tint">Upgrade</Link>}
              <Link href="/profile" className="flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-sm font-medium hover:bg-white">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-bold text-white">{(user.name || user.email)[0].toUpperCase()}</span>
                {user.name?.split(' ')[0] || 'Profile'}
              </Link>
              <button onClick={signOut} className="rounded-[6px] p-2 text-ink-soft hover:bg-white" title="Sign out"><LogOut size={16} /></button>
            </>
          ) : (
            <>
              {path !== '/login' && path !== '/' && <Link href="/login" className="btn-ghost">Sign in</Link>}
              {path !== '/register' && <Link href="/register" className="btn-primary">Create free account</Link>}
            </>
          ))}
        </div>
        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
      </nav>
      {open && (
        <div className="border-t border-line bg-paper px-4 py-3 md:hidden" onClick={() => setOpen(false)}>
          {[...(user ? LINKS : []), ...(user ? [['/profile', 'Profile & CV'], ['/billing', user.access?.active ? 'Billing' : 'Upgrade to Pro'], ...(user.role === 'admin' ? [['/admin', 'Admin panel']] : [])] : [['/login', 'Sign in'], ['/register', 'Create account']])].map(([href, label]) => (
            <Link key={href} href={href} className="block rounded-[6px] px-3 py-2.5 font-medium hover:bg-white">{label}</Link>
          ))}
          {user && <button onClick={signOut} className="block w-full rounded-[6px] px-3 py-2.5 text-left font-medium text-danger">Sign out</button>}
        </div>
      )}
    </header>
  );
}
