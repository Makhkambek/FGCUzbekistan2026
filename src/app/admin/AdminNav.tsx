'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

const SECTIONS = [
  { href: '/admin/teams', label: 'Teams' },
  { href: '/admin/schedule', label: 'Schedule' },
  { href: '/admin/matches', label: 'Matches' },
  { href: '/admin/alliances', label: 'Alliances & Playoffs' },
  { href: '/admin/skills', label: 'Skills' },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [logoutError, setLogoutError] = useState('');

  async function logout() {
    // Redirecting regardless of the result made a failed logout look like a
    // successful one: the cookie stays valid, so anyone walking up to the
    // laptop is still signed in.
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (!res.ok) { setLogoutError('Could not sign out — try again'); return; }
    } catch {
      setLogoutError('Could not sign out — check the connection'); return;
    }
    router.push('/login');
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10 px-4 sm:px-8 h-14 flex items-center justify-between gap-4 overflow-x-auto">
      <div className="flex items-center gap-1 sm:gap-2">
        <Link href="/admin" className="font-bold text-gray-900 text-sm mr-2 sm:mr-4 whitespace-nowrap">
          FGC admin
        </Link>
        {SECTIONS.map((s) => {
          const active = pathname === s.href || pathname.startsWith(s.href + '/');
          return (
            <Link key={s.href} href={s.href}
              className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold whitespace-nowrap ${
                active ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}>
              {s.label}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a href="/display" target="_blank" rel="noopener noreferrer"
          className="px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold text-gray-500 hover:text-gray-900 border border-gray-200 hover:bg-gray-50 whitespace-nowrap">
          Display ↗
        </a>
        <a href="/" target="_blank" rel="noopener noreferrer"
          className="px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold text-gray-500 hover:text-gray-900 border border-gray-200 hover:bg-gray-50 whitespace-nowrap">
          Public ↗
        </a>
        {logoutError && (
          <span className="text-xs text-red-600 whitespace-nowrap" role="alert">{logoutError}</span>
        )}
        <button onClick={logout}
          className="px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 whitespace-nowrap">
          Log out
        </button>
      </div>
    </header>
  );
}
