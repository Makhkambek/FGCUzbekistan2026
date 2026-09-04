'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { matchLabel } from '@/lib/match-label';
import { computeMatchScores } from '@/lib/scoring/match';
import type { ClimbPosition, CardType } from '@/lib/scoring/types';
import type { MatchRow } from '@/lib/db/matches';

const CLIMBS: { value: ClimbPosition; label: string }[] = [
  { value: 'none', label: 'None' }, { value: 'contact', label: 'Contact' },
  { value: 'zone1', label: 'Zone 1' }, { value: 'zone2', label: 'Zone 2' },
  { value: 'zone3', label: 'Zone 3' },
];
const CARDS: CardType[] = ['none', 'yellow', 'white', 'red'];

// The limits below mirror what matchResultSchema enforces on the server.
// Capping the inputs here keeps a field from accepting what the API would reject.
const MAX_WILDFIRE = 500; // suppression, extinguisher
/** Three robots can lift two partners between them; two can lift one. */
const MAX_PARTNER_CLIMB = 2;
const MAX_PARTNER_CLIMB_PLAYOFF = 1;
const MAX_FOULS = 20;

// text-base = 16px: anything smaller makes iOS zoom the page on focus,
// which on a referee's tablet reads as the form jumping around. min-h-11
// (44px) is the smallest comfortable tap target.
const INPUT_CLASS = 'w-24 px-2 py-1 text-base min-h-11 rounded-md bg-white text-gray-900 border border-gray-300 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100';
const SELECT_CLASS = 'px-2 py-1 text-base min-h-11 rounded-md bg-white text-gray-900 border border-gray-300 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100';

type Trio<T> = [T, T, T];

export default function MatchForm({ match, teamNames, nextMatch }: {
  match: MatchRow; teamNames: Record<number, string>;
  /** The next unplayed match of this phase, offered after a successful save. */
  nextMatch: { id: number; label: string } | null;
}) {
  const router = useRouter();
  const [suppressionRed, setSuppressionRed] = useState(match.suppression_red);
  const [suppressionBlue, setSuppressionBlue] = useState(match.suppression_blue);
  const [extinguisher, setExtinguisher] = useState(match.extinguisher);
  // climb_*/card_* come back from mysql2 typed as plain `string` (the schema
  // enforces the ENUM at the DB level, TypeScript can't see that) — same
  // narrowing cast already used for these columns in src/lib/standings.ts.
  const [climbRed, setClimbRed] = useState<Trio<ClimbPosition>>(
    [match.climb_red1, match.climb_red2, match.climb_red3] as Trio<ClimbPosition>);
  const [climbBlue, setClimbBlue] = useState<Trio<ClimbPosition>>(
    [match.climb_blue1, match.climb_blue2, match.climb_blue3] as Trio<ClimbPosition>);
  const maxPartnerClimb = match.phase === 'playoff' ? MAX_PARTNER_CLIMB_PLAYOFF : MAX_PARTNER_CLIMB;
  const [partnerRed, setPartnerRed] = useState(match.partner_climb_red);
  const [partnerBlue, setPartnerBlue] = useState(match.partner_climb_blue);
  const [minorRed, setMinorRed] = useState(match.minor_fouls_red);
  const [majorRed, setMajorRed] = useState(match.major_fouls_red);
  const [minorBlue, setMinorBlue] = useState(match.minor_fouls_blue);
  const [majorBlue, setMajorBlue] = useState(match.major_fouls_blue);
  const [cardRed, setCardRed] = useState<Trio<CardType>>(
    [match.card_red1, match.card_red2, match.card_red3] as Trio<CardType>);
  const [cardBlue, setCardBlue] = useState<Trio<CardType>>(
    [match.card_blue1, match.card_blue2, match.card_blue3] as Trio<CardType>);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startStatus, setStartStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [startError, setStartError] = useState('');
  const [going, setGoing] = useState(false);
  // The browser's own confirm() is a grey box in the corner of the screen that
  // a referee under pressure clicks through without reading. This one sits
  // where the eyes already are — right under the Save button.
  const [confirming, setConfirming] = useState(false);
  const [goStatus, setGoStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [goError, setGoError] = useState('');
  const [clampNote, setClampNote] = useState('');

  // Any edit after a save invalidates that save's confirmation — a stale
  // "✓ Saved" next to a value the judge just changed would tell them
  // an unsent correction is already safe, which is worse than no indicator.
  // The clamp note belongs to the value on screen — a new edit invalidates it
  // the same way it invalidates the "Saved" tick.
  function markDirty() {
    setSaveStatus('idle');
    setSaveError('');
    setClampNote('');
  }

  const preview = computeMatchScores({
    extinguisher,
    red: { suppression: suppressionRed, climbs: climbRed, partnerClimbs: partnerRed,
           minorFouls: minorRed, majorFouls: majorRed },
    blue: { suppression: suppressionBlue, climbs: climbBlue, partnerClimbs: partnerBlue,
            minorFouls: minorBlue, majorFouls: majorBlue },
  });

  async function save({ confirmed = false } = {}) {
    // The Save button is disabled while a request is in flight, but Enter in
    // any number field calls this directly and never looks at the button. Two
    // overlapping PUTs then race, and the one that lands last wins — a
    // referee correcting a score could watch the older values win while
    // "✓ Saved" claimed the correction had gone through.
    if (saving || resetting) return;

    // Saving an unplayed match is the irreversible transition — it records a
    // real result for six teams and, from then on, blocks schedule/playoff
    // regeneration. A misclick on an already-played match is just a
    // correction, so re-saves stay frictionless and skip this prompt.
    if (!match.played && !confirmed) {
      setConfirming(true);
      return;
    }
    setConfirming(false);

    setSaving(true);
    setSaveStatus('idle');
    setSaveError('');
    try {
      const res = await fetch(`/api/admin/matches/${match.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suppressionRed, suppressionBlue, extinguisher,
          climbRed, climbBlue, partnerClimbRed: partnerRed, partnerClimbBlue: partnerBlue,
          minorFoulsRed: minorRed, majorFoulsRed: majorRed,
          minorFoulsBlue: minorBlue, majorFoulsBlue: majorBlue,
          cardRed, cardBlue,
        }),
      });
      if (res.ok) {
        setSaveStatus('ok');
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveStatus('error');
        setSaveError(data.error ?? `Could not save (status ${res.status})`);
      }
    } catch {
      setSaveStatus('error');
      setSaveError('Could not save — check the connection and try again');
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (saving || resetting) return;
    if (!window.confirm(
      `Clear the entered result for match ${match.match_number} and mark it as not played?`,
    )) return;

    setResetting(true);
    setSaveStatus('idle');
    setSaveError('');
    try {
      const res = await fetch(`/api/admin/matches/${match.id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuppressionRed(0); setSuppressionBlue(0); setExtinguisher(0);
        setClimbRed(['none', 'none', 'none']); setClimbBlue(['none', 'none', 'none']);
        setPartnerRed(0); setPartnerBlue(0);
        setMinorRed(0); setMajorRed(0); setMinorBlue(0); setMajorBlue(0);
        setCardRed(['none', 'none', 'none']); setCardBlue(['none', 'none', 'none']);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveStatus('error');
        setSaveError(data.error ?? `Could not reset (status ${res.status})`);
      }
    } catch {
      setSaveStatus('error');
      setSaveError('Could not reset — check the connection and try again');
    } finally {
      setResetting(false);
    }
  }

  // Two steps on purpose. Preview puts the teams on the projector so the hall
  // can read the alliances while robots are placed; the clock only starts when
  // the referee presses the second button.
  async function previewMatch() {
    if (starting) return;
    setStarting(true);
    setStartStatus('idle');
    setStartError('');
    try {
      const res = await fetch('/api/admin/display/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.id }),
      });
      if (res.ok) {
        setStartStatus('ok');
        // Only the confirmation self-clears; an error stays until the next
        // press. The request is fast enough that "Starting…" flashes by, so
        // a successful press needs something that outlives it.
        setTimeout(() => setStartStatus('idle'), 4000);
      } else {
        const data = await res.json().catch(() => ({}));
        setStartStatus('error');
        setStartError(data.error ?? `Could not start (status ${res.status})`);
      }
    } catch {
      setStartStatus('error');
      setStartError('Could not show it — check the connection and try again');
    } finally {
      setStarting(false);
    }
  }

  async function startClock() {
    if (going) return;
    setGoing(true);
    setGoStatus('idle');
    setGoError('');
    try {
      const res = await fetch('/api/admin/display/go', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.id }),
      });
      if (res.ok) {
        setGoStatus('ok');
        setTimeout(() => setGoStatus('idle'), 4000);
      } else {
        const data = await res.json().catch(() => ({}));
        setGoStatus('error');
        setGoError(data.error ?? `Could not start (status ${res.status})`);
      }
    } catch {
      setGoStatus('error');
      setGoError('Could not start — check the connection and try again');
    } finally {
      setGoing(false);
    }
  }

  const num = (v: number, set: (n: number) => void, max = MAX_WILDFIRE) => (
    <input type="number" min={0} max={max} value={v}
      // Out-of-range input is clamped silently, so say what happened rather
      // than letting the referee believe the number they typed went in.
      onBlur={(e) => {
        const typed = Math.trunc(Number(e.target.value));
        setClampNote(Number.isFinite(typed) && typed > max
          ? `${typed} is above the maximum of ${max} — saved as ${max}` : '');
      }}
      // A focused number input takes the scroll wheel as a value change, so
      // scrolling down to the Save button silently edits the field the
      // referee just typed into.
      onWheel={(e) => e.currentTarget.blur()}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
      onChange={(e) => {
        const n = Math.trunc(Number(e.target.value));
        set(Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0);
        markDirty();
      }}
      className={INPUT_CLASS} />
  );

  const side = (
    // A playoff alliance is two robots, so the third slot arrives empty and
    // is left out of the form — there is nothing to score for a robot that is
    // not on the field, and an empty row invites a climb to be entered for it.
    color: 'red' | 'blue', teams: (number | null)[],
    climbs: Trio<ClimbPosition>, setClimbs: (t: Trio<ClimbPosition>) => void,
    cards: Trio<CardType>, setCards: (t: Trio<CardType>) => void,
  ) => (
    <div className={`space-y-2 p-4 rounded-md border ${color === 'red' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${color === 'red' ? 'text-red-700' : 'text-blue-700'}`}>
        {color === 'red' ? 'Red' : 'Blue'}
      </p>
      {teams.map((teamId, i) => teamId === null ? null : (
        <div key={teamId} className="flex items-center gap-2">
          <span className="w-40 truncate text-gray-900">{teamNames[teamId] ?? teamId}</span>
          <select value={climbs[i]}
            onChange={(e) => {
              const next = [...climbs] as Trio<ClimbPosition>;
              next[i] = e.target.value as ClimbPosition; setClimbs(next);
              markDirty();
            }}
            className={SELECT_CLASS}>
            {CLIMBS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={cards[i]}
            onChange={(e) => {
              const next = [...cards] as Trio<CardType>;
              next[i] = e.target.value as CardType; setCards(next);
              markDirty();
            }}
            className={SELECT_CLASS}>
            {CARDS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      ))}
    </div>
  );

  return (
    <div className="bg-white rounded-lg p-6 space-y-4 border border-gray-200 shadow-sm">
      <div className="flex items-center gap-3">
        {/* Same name the hall and the projector use: a qualification match is
            Q13 here too, not "Match 13". */}
        <h3 className="font-semibold text-gray-900">{matchLabel(match.phase, match.match_number)}</h3>
        {match.played ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
            Played
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
            Not played
          </span>
        )}
        {startStatus === 'ok' && (
          <span className="ml-auto text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-1">
            ✓ Shown on display
          </span>
        )}
        {goStatus === 'ok' && (
          <span className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-1">
            ✓ Counting down
          </span>
        )}
        <button onClick={previewMatch} disabled={starting}
          className={`px-3 py-1 rounded-md text-white text-sm font-semibold disabled:opacity-50 transition-colors ${
            startStatus === 'ok'
              ? 'ml-auto bg-green-600 hover:bg-green-700'
              : 'ml-auto bg-blue-600 hover:bg-blue-700'
          }`}>
          {starting ? 'Showing…' : 'Preview on display'}
        </button>
        {/* Deliberately the loudest control on the page: this is the one that
            starts 3-2-1 and the 2:30 in front of the whole hall. */}
        <button onClick={startClock} disabled={going}
          className="px-4 py-1 rounded-md bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-50 transition-colors">
          {going ? 'Starting…' : 'Start match ▶'}
        </button>
        {startStatus === 'error' && startError && (
          <span className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
            Error: {startError}
          </span>
        )}
        {goStatus === 'error' && goError && (
          <span className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
            Error: {goError}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {side('red', [match.red1_id, match.red2_id, match.red3_id], climbRed, setClimbRed, cardRed, setCardRed)}
        {side('blue', [match.blue1_id, match.blue2_id, match.blue3_id], climbBlue, setClimbBlue, cardBlue, setCardBlue)}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
        <label className="flex justify-between items-center">Red suppression {num(suppressionRed, setSuppressionRed)}</label>
        <label className="flex justify-between items-center">Blue suppression {num(suppressionBlue, setSuppressionBlue)}</label>
        {/* Two robots in a playoff alliance can only lift one partner between
            them; three can lift two. The cap follows the phase so a final
            cannot be given a climb that did not happen. */}
        <label className="flex justify-between items-center">Red partner climbs {num(partnerRed, setPartnerRed, maxPartnerClimb)}</label>
        <label className="flex justify-between items-center">Blue partner climbs {num(partnerBlue, setPartnerBlue, maxPartnerClimb)}</label>
        <label className="flex justify-between items-center">Red minor fouls {num(minorRed, setMinorRed, MAX_FOULS)}</label>
        <label className="flex justify-between items-center">Blue minor fouls {num(minorBlue, setMinorBlue, MAX_FOULS)}</label>
        <label className="flex justify-between items-center">Red major fouls {num(majorRed, setMajorRed, MAX_FOULS)}</label>
        <label className="flex justify-between items-center">Blue major fouls {num(majorBlue, setMajorBlue, MAX_FOULS)}</label>
        <label className="flex justify-between items-center col-span-2">
          Extinguisher (shared) {num(extinguisher, setExtinguisher)}
        </label>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <div className="text-sm">
          <span className="text-red-600 font-mono text-lg">{preview.red}</span>
          <span className="text-gray-500"> : </span>
          <span className="text-blue-600 font-mono text-lg">{preview.blue}</span>
          <span className="text-gray-500 ml-4">
            multipliers {preview.redMultiplier.toFixed(2)} / {preview.blueMultiplier.toFixed(2)} ·
            coopertition {preview.coopertition}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {clampNote && (
            <span className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
              {clampNote}
            </span>
          )}
          {saveStatus === 'ok' && (
            <span className="text-sm text-green-600">✓ Saved</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
              Error: {saveError}
            </span>
          )}
          {match.played && (
            <button onClick={reset} disabled={saving || resetting}
              className="px-4 py-2 rounded-md bg-white text-red-600 font-semibold border border-red-300 hover:bg-red-50 disabled:opacity-50">
              {resetting ? 'Resetting…' : 'Reset'}
            </button>
          )}
          <button onClick={() => save()} disabled={saving || resetting}
            className="px-4 py-2 rounded-md bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {confirming && (
        <div className="border-t border-gray-100 pt-4 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-gray-800 max-w-md">
            <strong>{matchLabel(match.phase, match.match_number)}</strong> has not been played yet.
            Saving records the result for all six teams and locks the schedule.
          </p>
          <div className="flex items-center gap-3">
            <button onClick={() => setConfirming(false)}
              className="px-4 py-2 rounded-md bg-white text-gray-700 font-semibold border border-gray-300 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={() => save({ confirmed: true })} disabled={saving}
              className="px-5 py-2 rounded-md bg-amber-600 text-white font-bold hover:bg-amber-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Yes, save the result'}
            </button>
          </div>
        </div>
      )}

      {/* After a save the next thing a referee does is score the next match,
          so it is offered here rather than back through the list. */}
      {saveStatus === 'ok' && nextMatch && (
        <div className="border-t border-gray-100 pt-4 flex flex-col items-center gap-2">
          <span className="text-sm text-green-700">✓ Saved</span>
          <button onClick={() => router.push(`/admin/matches/${nextMatch.id}`)}
            className="px-5 py-2 rounded-md bg-blue-600 text-white font-bold hover:bg-blue-700">
            Next match: {nextMatch.label} →
          </button>
        </div>
      )}
      {saveStatus === 'ok' && !nextMatch && (
        <p className="border-t border-gray-100 pt-4 text-center text-sm text-gray-500">
          ✓ Saved — no matches left to score in this phase
        </p>
      )}
    </div>
  );
}
