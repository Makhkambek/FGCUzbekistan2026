'use client';
import { useState } from 'react';

export default function ShowStandingsButton() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  async function showStandings() {
    setBusy(true);
    setStatus('idle');
    try {
      const res = await fetch('/api/admin/display/standings', { method: 'POST' });
      setStatus(res.ok ? 'ok' : 'error');
    } catch {
      setStatus('error');
    } finally {
      setBusy(false);
      setTimeout(() => setStatus('idle'), 2500);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {status === 'ok' && <span className="text-sm text-green-600">✓ Display switched</span>}
      {status === 'error' && <span className="text-sm text-red-600">Could not switch the display</span>}
      <button onClick={showStandings} disabled={busy}
        className="px-3 py-1.5 rounded-md bg-gray-700 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50">
        {busy ? 'Switching…' : 'Show standings on display'}
      </button>
    </div>
  );
}
