'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    setBusy(false);
    if (res.ok) router.push('/admin');
    else setError((await res.json().catch(() => ({}))).error ?? 'Ошибка входа');
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 p-8 bg-slate-900 rounded-lg">
        <h1 className="text-xl font-semibold">FGC Uzbekistan · вход</h1>
        <input className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700"
          placeholder="Логин" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700"
          type="password" placeholder="Пароль" value={password}
          onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button disabled={busy}
          className="w-full py-2 rounded bg-orange-600 hover:bg-orange-500 disabled:opacity-50">
          {busy ? 'Вход…' : 'Войти'}
        </button>
      </form>
    </main>
  );
}
