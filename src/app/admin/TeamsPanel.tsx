'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TeamsPanel({ teams }: { teams: { id: number; name: string; region: string | null }[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim() || busy) return;
    setMessage('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, region: region || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setName(''); setRegion('');
      } else {
        setMessage(data.error ?? 'Something went wrong');
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setMessage('');
    const res = await fetch(`/api/admin/teams?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? 'Something went wrong');
    }
    router.refresh();
  }

  return (
    <section className="bg-white rounded-lg p-6 space-y-4 border border-gray-200 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Teams ({teams.length})</h2>
      <div className="flex gap-2">
        <input className="flex-1 px-3 py-2 rounded-md bg-white text-gray-900 placeholder-gray-400 border border-gray-300 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
          placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-40 px-3 py-2 rounded-md bg-white text-gray-900 placeholder-gray-400 border border-gray-300 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
          placeholder="Region" value={region} onChange={(e) => setRegion(e.target.value)} />
        <button onClick={add} disabled={busy}
          className="px-4 py-2 rounded-md bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50">
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>
      {message && <p className="text-sm text-red-600">{message}</p>}
      <ul className="divide-y divide-gray-100">
        {teams.map((t) => (
          <li key={t.id} className="flex justify-between items-center py-2 hover:bg-gray-50">
            <span className="text-gray-900">{t.id}. {t.name}{t.region ? ` · ${t.region}` : ''}</span>
            <button onClick={() => remove(t.id)} className="text-red-600 hover:text-red-700">
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
