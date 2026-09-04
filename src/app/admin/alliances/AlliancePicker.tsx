'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isPickable, clearPick } from '@/lib/alliances/selection';
import type { SelectionState } from '@/lib/alliances/selection';

interface PlayoffStatus { matches: number; played: number }

export default function AlliancePicker({ teamNames }: { teamNames: Record<number, string> }) {
  const router = useRouter();
  const [state, setState] = useState<SelectionState | null>(null);
  const [ranked, setRanked] = useState<number[]>([]);
  const [playoff, setPlayoff] = useState<PlayoffStatus | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  // One shared flag used to drive every button's label, so an ordinary pick
  // made the Reset button read "Resetting…" in the middle of a live draft
  // ceremony. The flag still blocks all buttons; only the wording is per-action.
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<'pick' | 'reset' | 'playoff' | null>(null);
  // Distinguishing "no playoff yet" from "we could not find out": on a failed
  // request the draft used to look unlocked and offered to create a bracket
  // that the server would then refuse.
  const [playoffUnknown, setPlayoffUnknown] = useState(false);
  // Why the draft is not open yet, straight from the server, so the page can
  // say "4 qualification matches still to play" instead of letting a referee
  // discover it by being refused.
  const [notReady, setNotReady] = useState<string | null>(null);

  function load() {
    return Promise.all([
      fetch('/api/admin/alliances').then((res) => res.json().catch(() => ({})).then((data) => ({ res, data }))),
      // Playoff status decides whether the button below is "create" or
      // "re-create" — fetched alongside alliances so it's always current.
      fetch('/api/admin/playoff').then((res) => res.json().catch(() => ({})).then((data) => ({ res, data }))),
    ])
      .then(([alliances, playoffStatus]) => {
        if (alliances.res.ok) {
          setState(alliances.data.state);
          setRanked(alliances.data.ranked);
          setNotReady(alliances.data.notReadyReason ?? null);
          setError('');
        } else {
          setState(null);
          setError(alliances.data.error ?? `Could not load data (status ${alliances.res.status})`);
        }
        setPlayoff(playoffStatus.res.ok
          ? { matches: playoffStatus.data.matches, played: playoffStatus.data.played }
          : null);
        setPlayoffUnknown(!playoffStatus.res.ok);
      })
      .catch(() => {
        setState(null);
        setError('Could not load data — check the connection and try again');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function pick(allianceSeed: number, slotIndex: 0 | 1, teamId: number) {
    if (!state) return;
    setError('');
    setAction('pick');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/alliances', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allianceSeed, slotIndex, teamId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setState(data.state);
      else setError(data.error ?? `Could not register the pick (status ${res.status})`);
    } catch {
      setError('Could not register the pick — check the connection and try again');
    } finally {
      setBusy(false); setAction(null);
    }
  }

  async function clearSlot(allianceSeed: number, slotIndex: 0 | 1) {
    if (!window.confirm('Clear this pick?')) return;
    setError('');
    setAction('pick');
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/alliances?seed=${allianceSeed}&slot=${slotIndex}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setState(data.state);
      else setError(data.error ?? `Could not clear the pick (status ${res.status})`);
    } catch {
      setError('Could not clear the pick — check the connection and try again');
    } finally {
      setBusy(false); setAction(null);
    }
  }

  // There is no per-pick undo besides clearing one slot at a time, so this
  // is the one chance to catch a misclick that needs a clean restart: during
  // a live ceremony this button sits right below the picker, and it
  // discards every pick made so far with no way back.
  function reset() {
    const madePicks = state?.reduce((acc, a) => acc + a.picks.filter((p) => p !== null).length, 0) ?? 0;
    const ok = window.confirm(
      madePicks > 0
        ? `Reset the whole alliance selection? All picks made so far (${madePicks}) will be lost — this cannot be undone.`
        : 'Reset the alliance selection?',
    );
    if (ok) performReset();
  }

  async function performReset() {
    setError('');
    setAction('reset');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/alliances', { method: 'DELETE' });
      if (res.ok) {
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Could not reset the selection (status ${res.status})`);
      }
    } catch {
      setError('Could not reset the selection — check the connection and try again');
    } finally {
      setBusy(false); setAction(null);
    }
  }

  async function generatePlayoff() {
    setError('');
    setAction('playoff');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/playoff', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? `Could not create playoff matches (status ${res.status})`);
      else router.push('/admin/matches');
    } catch {
      setError('Could not create playoff matches — check the connection and try again');
    } finally {
      setBusy(false); setAction(null);
    }
  }

  async function clearPlayoff() {
    if (!window.confirm(
      'Delete the playoff bracket and every result in it? This is how a '
      + 'rehearsal is wiped before the real event. A rollback point is kept.')) return;
    setError('');
    setAction('playoff');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/playoff', { method: 'DELETE' });
      if (!res.ok) setError(`Could not clear the playoff (status ${res.status})`);
      else router.refresh();
    } catch {
      setError('Could not clear the playoff — check the connection and try again');
    } finally {
      setBusy(false); setAction(null);
    }
  }

  // Re-creation is the destructive path: only offered while the server would
  // still allow it (no playoff match played yet), and only after the operator
  // confirms exactly what gets deleted. The server re-checks this regardless
  // — this dialog is a courtesy, not the safeguard.
  function regeneratePlayoff() {
    const count = playoff?.matches ?? 0;
    const ok = window.confirm(
      `This deletes every current playoff match (${count}) and rebuilds the bracket. Continue?`,
    );
    if (ok) generatePlayoff();
  }

  if (loading) return <p className="text-gray-500">Loading…</p>;

  if (!state) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2" role="alert">
          {error || 'Could not load data'}
        </p>
        <button onClick={load} className="px-4 py-2 rounded-md bg-white border border-gray-300 hover:bg-gray-50 text-gray-900 text-sm">
          Retry
        </button>
      </div>
    );
  }

  const locked = !!playoff && playoff.matches > 0;
  const complete = state.every((a) => a.picks[0] !== null && a.picks[1] !== null);
  // Unfinished qualification closes the draft exactly like an existing bracket
  // does — captains come from the final ranking, and there is no clean way
  // back once alliances are seated on a ranking that then changes.
  const closed = locked || notReady !== null;

  return (
    <div className="space-y-6">
      {notReady && !locked && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2" role="alert">
          {notReady}. The captains below are the standings as they are right now,
          and they will keep moving until the last match is scored.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {state.map((a) => (
          <div key={a.seed} className="p-4 rounded-lg bg-white border border-gray-200 shadow-sm space-y-3">
            <div>
              <h3 className="font-semibold text-gray-900">Alliance {a.seed}</h3>
              <p className="text-sm text-gray-500">Captain: {teamNames[a.captain] ?? a.captain}</p>
            </div>

            {closed ? (
              <p className="text-xs text-gray-400">
                {locked ? 'Locked — playoff matches already exist' : 'Waiting for qualification to finish'}
              </p>
            ) : (
              ([0, 1] as const).map((slot) => {
                const currentValue = a.picks[slot];
                // Pretend this slot is empty before computing its options, so
                // whatever already sits there still shows up as selected
                // instead of vanishing from its own dropdown.
                const hypothetical = currentValue !== null ? clearPick(state, a.seed, slot) : state;
                const available = ranked.filter((id) => isPickable(hypothetical, a.seed, id));

                return (
                  <label key={slot} className="block text-sm text-gray-700 space-y-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pick {slot + 1}</span>
                    <select
                      value={currentValue ?? ''}
                      disabled={busy}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          if (currentValue !== null) clearSlot(a.seed, slot);
                        } else {
                          pick(a.seed, slot, Number(val));
                        }
                      }}
                      className="w-full px-2 py-1.5 rounded-md bg-white text-gray-900 border border-gray-300 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:opacity-50"
                    >
                      <option value="">— choose a team —</option>
                      {available.map((id) => (
                        <option key={id} value={id}>{teamNames[id] ?? id}</option>
                      ))}
                    </select>
                  </label>
                );
              })
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2" role="alert">
          {error}
        </p>
      )}

      {complete && playoffUnknown && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2" role="alert">
          Could not read the playoff status — reload the page before creating or
          changing the bracket. Acting now may be refused by the server.
        </p>
      )}

      {complete && !playoffUnknown && !notReady && (
        playoff && playoff.matches > 0 ? (
          <div className="bg-white rounded-lg p-4 space-y-2 border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-700">
              Playoff matches created: {playoff.matches}, played: {playoff.played}
            </p>
            {playoff.played === 0 ? (
              <button onClick={regeneratePlayoff} disabled={busy}
                className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-500 text-xs hover:text-gray-700 hover:border-gray-400 disabled:opacity-50">
                {busy && action === 'playoff' ? 'Rebuilding…' : 'Rebuild the playoff bracket'}
              </button>
            ) : (
              <p className="text-xs text-gray-500">
                Rebuilding is unavailable — some playoff matches have been played
              </p>
            )}
            {/* Clearing is offered whether or not the bracket has been played:
                it is the way a rehearsal comes off the board before the real
                event, which rebuilding cannot do once a match is scored. */}
            <button onClick={clearPlayoff} disabled={busy}
              className="px-3 py-1.5 rounded-md border border-red-300 text-red-700 text-xs hover:bg-red-50 disabled:opacity-50">
              Clear the playoff
            </button>
          </div>
        ) : (
          <button onClick={generatePlayoff} disabled={busy}
            className="px-4 py-2 rounded-md bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50">
            {busy && action === 'playoff' ? 'Creating…' : 'Create playoff matches'}
          </button>
        )
      )}

      {closed ? (
        <p className="text-xs text-gray-400">
          {locked
            ? 'Alliance selection is locked — playoff matches already exist'
            : 'Alliance selection opens when every qualification match has been scored'}
        </p>
      ) : (
        <div className="border-t border-gray-200 pt-4">
          <button onClick={reset} disabled={busy}
            className="px-4 py-2 rounded-md bg-white text-red-600 font-semibold border border-red-300 hover:bg-red-50 disabled:opacity-50">
            {busy && action === 'reset' ? 'Resetting…' : 'Reset alliance selection'}
          </button>
          <p className="text-xs text-gray-500 mt-1.5">
            Clears every pick made so far for all three alliances. This cannot be undone.
          </p>
        </div>
      )}
    </div>
  );
}
