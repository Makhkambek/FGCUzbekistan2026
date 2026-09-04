'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { scheduleShape, evenMatchesPerTeam } from '@/lib/schedule/generate';

export default function SchedulePanel({ matchCount, teamCount }: { matchCount: number; teamCount: number }) {
  const hasSchedule = matchCount > 0;
  const router = useRouter();
  const [matchesPerTeam, setMatchesPerTeam] = useState(5);
  // Six teams play a match, so unless teams × matchesPerTeam divides by 6 the
  // schedule cannot be equal for everyone. Say so before the button is
  // pressed rather than leaving it to be noticed in the standings.
  const shape = teamCount >= 6 ? scheduleShape(teamCount, matchesPerTeam) : null;
  const evenAlternative = teamCount >= 6 ? evenMatchesPerTeam(teamCount, matchesPerTeam) : null;
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  // Every destructive action here now leaves a rollback point behind. The page
  // has to show it, or nobody will know it exists at the moment they need it.
  const [snapshot, setSnapshot] = useState<
    { matchCount: number; playedCount: number; createdAt: number; reason: string } | null>(null);
  const [restoreBlocked, setRestoreBlocked] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const loadSnapshot = useCallback(() => {
    fetch('/api/admin/schedule/restore')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setSnapshot(data.snapshot);
        setRestoreBlocked(data.blockReason);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { loadSnapshot(); }, [loadSnapshot]);

  async function restore(force = false) {
    if (restoring) return;
    const question = force
      ? `${restoreBlocked}\n\nRestore anyway and lose those results?`
      : 'Put the qualification schedule back exactly as it was before the last reset, '
        + 'including every score that had been entered?';
    if (!window.confirm(question)) return;
    setMessage('');
    setRestoring(true);
    try {
      const res = await fetch(`/api/admin/schedule/restore${force ? '?force=1' : ''}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage(`Restored ${data.matches} matches exactly as they were`);
        loadSnapshot();
        router.refresh();
      } else {
        setMessage(data.error ?? `Could not restore (status ${res.status})`);
      }
    } catch {
      setMessage('Could not restore — check the connection and try again');
    } finally {
      setRestoring(false);
    }
  }

  async function generate() {
    // Reset asks twice; Generate asked nothing, yet it deletes and replaces
    // the whole qualification schedule. Printed sheets are already in the
    // teams' hands by then — the pairings would simply change under them.
    if (hasSchedule && !window.confirm(
      'A schedule already exists. Generating again deletes it and creates a different one — '
      + 'any printed match sheets become wrong. Continue?')) return;
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
          // Clearing the field used to leave 0 behind, which the API rejects
          // as "Invalid parameters" — clamp into the range the server accepts.
          onChange={(e) => {
            const n = Math.trunc(Number(e.target.value));
            setMatchesPerTeam(Number.isFinite(n) && n > 0 ? Math.min(20, n) : 1);
          }}
          onWheel={(e) => e.currentTarget.blur()}
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
      {shape && !hasSchedule && (
        shape.withExtra === 0
          ? (
            <p className="text-sm text-gray-600">
              {shape.totalMatches} matches — every team plays {shape.base}.
            </p>
          ) : (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {shape.totalMatches} matches — {shape.withExtra} team{shape.withExtra === 1 ? '' : 's'} would
              play {shape.base + 1} and the other {teamCount - shape.withExtra} would play {shape.base}.
              Rankings are averages with each team&apos;s worst match dropped, so an extra match does not
              inflate the ranking score, but it is one more shot at the best-match tiebreaker.
              {evenAlternative !== null && ` For an equal schedule use ${evenAlternative} matches per team.`}
            </p>
          )
      )}
      {snapshot && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 space-y-1.5">
          <p className="text-sm text-blue-900">
            <strong>Rollback point:</strong> {snapshot.matchCount} match{snapshot.matchCount === 1 ? '' : 'es'}
            {snapshot.playedCount > 0 && `, ${snapshot.playedCount} of them scored`}
            {' '}— saved automatically at {new Date(snapshot.createdAt).toLocaleTimeString()} before the last
            {snapshot.reason === 'regenerate' ? ' regeneration' : snapshot.reason === 'match-reset' ? ' cleared result' : ' reset'}.
          </p>
          {restoreBlocked ? (
            <div className="space-y-1.5">
              <p className="text-xs text-blue-800">{restoreBlocked}</p>
              <button onClick={() => restore(true)} disabled={restoring}
                className="px-3 py-1.5 rounded-md bg-white text-red-600 text-xs font-bold border border-red-300 hover:bg-red-50 disabled:opacity-50">
                {restoring ? 'Restoring…' : 'Restore anyway'}
              </button>
            </div>
          ) : (
            <button onClick={() => restore()} disabled={restoring}
              className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50">
              {restoring ? 'Restoring…' : 'Restore it exactly as it was'}
            </button>
          )}
        </div>
      )}

      {message && <p className="text-sm text-gray-700">{message}</p>}
      <p className="text-xs text-gray-500">
        The schedule can only be regenerated while no match has been played. Reset deletes all
        qualification matches so a new schedule can be generated — blocked once alliances or
        playoff matches exist.
      </p>
    </section>
  );
}
