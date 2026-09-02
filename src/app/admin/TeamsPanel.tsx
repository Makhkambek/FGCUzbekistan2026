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
        setMessage(data.error ?? 'Ошибка');
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
      setMessage(data.error ?? 'Ошибка');
    }
    router.refresh();
  }

  return (
    <section className="bg-slate-900 rounded-lg p-6 space-y-4">
      <h2 className="text-lg font-semibold">Команды ({teams.length})</h2>
      <div className="flex gap-2">
        <input className="flex-1 px-3 py-2 rounded bg-slate-800 border border-slate-700"
          placeholder="Название" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-40 px-3 py-2 rounded bg-slate-800 border border-slate-700"
          placeholder="Регион" value={region} onChange={(e) => setRegion(e.target.value)} />
        <button onClick={add} disabled={busy}
          className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-500 disabled:opacity-50">
          {busy ? 'Добавление…' : 'Добавить'}
        </button>
      </div>
      {message && <p className="text-sm text-red-400">{message}</p>}
      <ul className="divide-y divide-slate-800">
        {teams.map((t) => (
          <li key={t.id} className="flex justify-between py-2">
            <span>{t.id}. {t.name}{t.region ? ` · ${t.region}` : ''}</span>
            <button onClick={() => remove(t.id)} className="text-red-400 hover:text-red-300">
              Удалить
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
