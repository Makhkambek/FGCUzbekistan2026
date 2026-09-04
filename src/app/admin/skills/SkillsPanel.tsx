'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_ATTEMPTS } from '@/lib/skills/scoring';

interface Team { id: number; name: string }
interface Attempt {
  id: number; round: number; teamId: number; teamName: string;
  alliance: 'red' | 'blue'; played: boolean; score: number | null;
}
export default function SkillsPanel({ teams, attempts }: {
  teams: Team[]; attempts: Attempt[];
}) {
  const router = useRouter();
  const hasOrder = attempts.length > 0;
  const anyPlayed = attempts.some((a) => a.played);

  // Nobody is picked to start with. Skills is opt-in — a team that has gone
  // home, or whose robot is dead by then, should never end up in the order
  // because someone forgot to untick them.
  //
  // Once an order exists the boxes show who is actually in it, so the panel
  // reads as the truth on the field rather than as an empty form.
  const teamsInOrder = [...new Set(attempts.map((a) => a.teamId))];
  const [selected, setSelected] = useState<number[]>(teamsInOrder);
  const [attemptsPerTeam, setAttemptsPerTeam] = useState(DEFAULT_ATTEMPTS);
  const [alliance, setAlliance] = useState<'red' | 'blue'>('red');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [rowBusy, setRowBusy] = useState<number | null>(null);

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allPicked = selected.length === teams.length;

  async function generate() {
    if (busy) return;
    if (hasOrder && !window.confirm(
      'A skills order already exists. Building a new one replaces it. Continue?')) return;
    setMessage('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/skills', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamIds: selected, attemptsPerTeam, alliance }),
      });
      const data = await res.json().catch(() => ({}));
      setMessage(res.ok ? `Skills order created: ${data.attempts} attempts` : (data.error ?? 'Could not create the order'));
      if (res.ok) router.refresh();
    } catch {
      setMessage('Could not create the order — check the connection');
    } finally {
      setBusy(false);
    }
  }

  async function clearPhase() {
    if (busy) return;
    if (!window.confirm(
      'Delete the skills order and every result in it? This is how a rehearsal '
      + 'is wiped before the real event, and it cannot be undone.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/skills', { method: 'DELETE' });
      if (res.ok) { setSelected([]); router.refresh(); }
      else setMessage('Could not clear the skills phase');
    } catch {
      setMessage('Could not clear the skills phase — check the connection');
    } finally {
      setBusy(false);
    }
  }

  async function setSide(id: number, side: 'red' | 'blue') {
    if (rowBusy !== null) return;
    setRowBusy(id);
    try {
      const res = await fetch(`/api/admin/skills/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alliance: side }),
      });
      if (res.ok) router.refresh();
      else setMessage('Could not change the side');
    } catch {
      setMessage('Could not change the side — check the connection');
    } finally {
      setRowBusy(null);
    }
  }

  const rounds = [...new Set(attempts.map((a) => a.round))].sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Who takes part{' '}
            <span className="text-sm font-normal text-gray-500">
              — {selected.length} of {teams.length} picked
            </span>
          </h2>
          <button
            onClick={() => setSelected(allPicked ? [] : teams.map((t) => t.id))}
            disabled={anyPlayed}
            className="px-3 py-1.5 rounded-md border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {allPicked ? 'Clear all' : 'Pick all'}
          </button>
        </div>
        {/* A tick box per team, in a list rather than a row of chips: the
            operator is reading down a list of who is in the hall and ticking
            names off it, and a tick is unambiguous where a shaded chip is
            not. */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => {
            const on = selected.includes(t.id);
            return (
              <button key={t.id} onClick={() => toggle(t.id)} disabled={anyPlayed}
                aria-pressed={on}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  on ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${
                  on ? 'bg-amber-600 border-amber-600 text-white' : 'bg-white border-gray-300'
                }`}>
                  {on && (
                    <svg viewBox="0 0 12 10" className="w-2.5 h-2.5" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 5.5L4.2 8.5L11 1.5" />
                    </svg>
                  )}
                </span>
                <span className="truncate">{t.name}</span>
              </button>
            );
          })}
        </div>
        {selected.length === 0 && !anyPlayed && (
          <p className="text-sm text-gray-500">Tick the teams that are taking part to build the order.</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-500">Attempts per team</label>
          <input type="number" min={1} max={10} value={attemptsPerTeam} disabled={anyPlayed}
            onChange={(e) => {
              const n = Math.trunc(Number(e.target.value));
              setAttemptsPerTeam(Number.isFinite(n) && n > 0 ? Math.min(10, n) : 1);
            }}
            onWheel={(e) => e.currentTarget.blur()}
            className="w-20 px-3 py-2 rounded-md bg-white text-gray-900 border border-gray-300 disabled:opacity-50" />
          <label className="text-sm text-gray-500">Starting side</label>
          <select value={alliance} disabled={anyPlayed}
            onChange={(e) => setAlliance(e.target.value as 'red' | 'blue')}
            className="px-3 py-2 rounded-md bg-white text-gray-900 border border-gray-300 disabled:opacity-50">
            <option value="red">Red</option>
            <option value="blue">Blue</option>
          </select>
          <button onClick={generate} disabled={busy || anyPlayed || selected.length === 0}
            className="px-4 py-2 rounded-md bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50">
            {busy ? 'Building…' : hasOrder ? 'Rebuild the order' : 'Build the order'}
          </button>
          {hasOrder && (
            <button onClick={clearPhase} disabled={busy}
              className="px-4 py-2 rounded-md border border-red-300 text-red-700 font-semibold hover:bg-red-50 disabled:opacity-50">
              Clear the skills phase
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600">
          {selected.length} team{selected.length === 1 ? '' : 's'} × {attemptsPerTeam} ={' '}
          {selected.length * attemptsPerTeam} attempts. The side can be changed per attempt below.
        </p>
        {anyPlayed && (
          <p className="text-xs text-gray-500">
            Attempts have been scored, so the order is locked — clear those results first to rebuild it.
          </p>
        )}
        {message && <p className="text-sm text-gray-700">{message}</p>}
      </div>

      {rounds.map((round) => (
        <div key={round} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-500 bg-gray-50 border-b border-gray-200">
            Attempt {round}
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {attempts.filter((a) => a.round === round).map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-semibold text-gray-900">{a.teamName}</td>
                  <td className="px-4 py-2.5 w-40">
                    <select value={a.alliance} disabled={rowBusy === a.id}
                      onChange={(e) => setSide(a.id, e.target.value as 'red' | 'blue')}
                      className={`px-2 py-1 rounded-md border text-sm font-semibold ${
                        a.alliance === 'red'
                          ? 'text-red-700 border-red-300 bg-red-50'
                          : 'text-blue-700 border-blue-300 bg-blue-50'
                      }`}>
                      <option value="red">Red side</option>
                      <option value="blue">Blue side</option>
                    </select>
                  </td>
                  <td className="px-4 py-2.5 w-28 text-center font-mono">
                    {a.played ? a.score : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 w-32 text-center">
                    {a.played
                      ? <span className="text-xs whitespace-nowrap px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Scored</span>
                      : <span className="text-xs whitespace-nowrap px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">Not scored</span>}
                  </td>
                  <td className="px-4 py-2.5 w-24 text-right">
                    <button onClick={() => router.push(`/admin/skills/${a.id}`)}
                      className="px-3 py-1 rounded-md border border-gray-300 text-xs font-semibold hover:bg-gray-50">
                      {a.played ? 'Edit' : 'Open'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

    </div>
  );
}
