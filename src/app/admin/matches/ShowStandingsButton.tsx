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
      // Only the confirmation fades. An error used to disappear on the same
      // timer, so a referee who glanced at the field for five seconds came
      // back to a button that looked untouched — with the projector still
      // showing the previous screen.
      if (res.ok) setTimeout(() => setStatus('idle'), 2500);
    } catch {
      setStatus('error');
    } finally {
      setBusy(false);
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
