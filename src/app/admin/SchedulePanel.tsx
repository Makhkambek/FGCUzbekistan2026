'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SchedulePanel({ matchCount }: { matchCount: number }) {
  const router = useRouter();
  const [matchesPerTeam, setMatchesPerTeam] = useState(5);
  const [message, setMessage] = useState('');

  async function generate() {
    setMessage('');
    const res = await fetch('/api/admin/schedule', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchesPerTeam, seed: Math.floor(Math.random() * 1_000_000) }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? `Создано матчей: ${data.matches}` : data.error ?? 'Ошибка');
    router.refresh();
  }

  return (
    <section className="bg-slate-900 rounded-lg p-6 space-y-4">
      <h2 className="text-lg font-semibold">Расписание квалификации ({matchCount} матчей)</h2>
      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-400">Матчей на команду</label>
        <input type="number" min={1} max={20} value={matchesPerTeam}
          onChange={(e) => setMatchesPerTeam(Number(e.target.value))}
          className="w-20 px-3 py-2 rounded bg-slate-800 border border-slate-700" />
        <button onClick={generate} className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-500">
          Сгенерировать
        </button>
      </div>
      {message && <p className="text-sm text-slate-300">{message}</p>}
      <p className="text-xs text-slate-500">
        Пересоздать расписание можно, только пока ни один матч не сыгран.
      </p>
    </section>
  );
}
