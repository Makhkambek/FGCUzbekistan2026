'use client';
import { useState } from 'react';

export default function ShowStandingsButton() {
  const [busy, setBusy] = useState(false);

  async function showStandings() {
    setBusy(true);
    try {
      await fetch('/api/admin/display/standings', { method: 'POST' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={showStandings} disabled={busy}
      className="px-3 py-1.5 rounded-md bg-gray-700 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50">
      {busy ? 'Switching…' : 'Show standings on display'}
    </button>
  );
}
