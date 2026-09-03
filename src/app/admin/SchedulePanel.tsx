'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SchedulePanel({ matchCount }: { matchCount: number }) {
  const router = useRouter();
  const [matchesPerTeam, setMatchesPerTeam] = useState(5);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function generate() {
    setMessage('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchesPerTeam, seed: Math.floor(Math.random() * 1_000_000) }),
      });
      const data = await res.json().catch(() => ({}));
      setMessage(res.ok ? `Matches created: ${data.matches}` : data.error ?? 'Something went wrong');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!window.confirm(
      'Delete the entire qualification schedule? All qualification matches — played or not — will be removed. This cannot be undone.',
    )) return;

    setMessage('');
    setResetting(true);
    try {
      const res = await fetch('/api/admin/schedule', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      setMessage(res.ok ? 'Qualification schedule cleared' : data.error ?? 'Something went wrong');
      router.refresh();
    } finally {
      setResetting(false);
    }
  }

  return (
    <section className="bg-white rounded-lg p-6 space-y-4 border border-gray-200 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Qualification schedule ({matchCount} matches)</h2>
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500">Matches per team</label>
        <input type="number" min={1} max={20} value={matchesPerTeam}
          onChange={(e) => setMatchesPerTeam(Number(e.target.value))}
          className="w-20 px-3 py-2 rounded-md bg-white text-gray-900 border border-gray-300 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
        <button onClick={generate} disabled={busy || resetting}
          className="px-4 py-2 rounded-md bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50">
          {busy ? 'Generating…' : 'Generate'}
        </button>
        <button onClick={reset} disabled={busy || resetting || matchCount === 0}
          className="px-4 py-2 rounded-md bg-white text-red-600 font-semibold border border-red-300 hover:bg-red-50 disabled:opacity-50">
          {resetting ? 'Resetting…' : 'Reset'}
        </button>
      </div>
      {message && <p className="text-sm text-gray-700">{message}</p>}
      <p className="text-xs text-gray-500">
        The schedule can only be regenerated while no match has been played. Reset deletes all
        qualification matches so a new schedule can be generated — blocked once alliances or
        playoff matches exist.
      </p>
    </section>
  );
}
