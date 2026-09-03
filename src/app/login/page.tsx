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
    <main className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-900">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 p-8 bg-white rounded-lg shadow-sm border border-gray-200">
        <h1 className="text-xl font-semibold">FGC Uzbekistan · вход</h1>
        <input className="w-full px-3 py-2 rounded-md bg-white text-gray-900 placeholder-gray-400 border border-gray-300 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
          placeholder="Логин" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input className="w-full px-3 py-2 rounded-md bg-white text-gray-900 placeholder-gray-400 border border-gray-300 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
          type="password" placeholder="Пароль" value={password}
          onChange={(e) => setPassword(e.target.value)} />
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
        )}
        <button disabled={busy}
          className="w-full py-2 rounded-md bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50">
          {busy ? 'Вход…' : 'Войти'}
        </button>
      </form>
    </main>
  );
}
