'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SchedulePanel({ matchCount }: { matchCount: number }) {
  const router = useRouter();
  const [matchesPerTeam, setMatchesPerTeam] = useState(5);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function generate() {
    setMessage('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchesPerTeam, seed: Math.floor(Math.random() * 1_000_000) }),
      });
      const data = await res.json().catch(() => ({}));
      setMessage(res.ok ? `Создано матчей: ${data.matches}` : data.error ?? 'Ошибка');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-white rounded-lg p-6 space-y-4 border border-gray-200 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Расписание квалификации ({matchCount} матчей)</h2>
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500">Матчей на команду</label>
        <input type="number" min={1} max={20} value={matchesPerTeam}
          onChange={(e) => setMatchesPerTeam(Number(e.target.value))}
          className="w-20 px-3 py-2 rounded-md bg-white text-gray-900 border border-gray-300 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
        <button onClick={generate} disabled={busy}
          className="px-4 py-2 rounded-md bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50">
          {busy ? 'Генерация…' : 'Сгенерировать'}
        </button>
      </div>
      {message && <p className="text-sm text-gray-700">{message}</p>}
      <p className="text-xs text-gray-500">
        Пересоздать расписание можно, только пока ни один матч не сыгран.
      </p>
    </section>
  );
}
