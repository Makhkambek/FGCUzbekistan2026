'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TeamsPanel({ teams }: { teams: { id: number; name: string; region: string | null }[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');

  async function add() {
    if (!name.trim()) return;
    await fetch('/api/admin/teams', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, region: region || undefined }),
    });
    setName(''); setRegion(''); router.refresh();
  }

  async function remove(id: number) {
    await fetch(`/api/admin/teams?id=${id}`, { method: 'DELETE' });
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
        <button onClick={add} className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-500">
          Добавить
        </button>
      </div>
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
