'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { skillsAttemptScore, HUMAN_BALL_POINTS } from '@/lib/skills/scoring';
import type { CardType, ClimbPosition } from '@/lib/scoring/types';

const CLIMBS: ClimbPosition[] = ['none', 'contact', 'zone1', 'zone2', 'zone3'];
const CARDS: CardType[] = ['none', 'yellow', 'white', 'red'];
const MAX_BALLS = 500;
const MAX_FOULS = 20;

interface Attempt {
  id: number; round: number; alliance: 'red' | 'blue'; teamName: string; played: boolean;
  suppression: number; humanBalls: number; climb: ClimbPosition; extinguisher: number;
  minorFouls: number; majorFouls: number; card: CardType;
}

export default function SkillsForm({ attempt, nextAttempt }: {
  attempt: Attempt; nextAttempt: { id: number; label: string } | null;
}) {
  const router = useRouter();
  const [suppression, setSuppression] = useState(attempt.suppression);
  const [humanBalls, setHumanBalls] = useState(attempt.humanBalls);
  const [climb, setClimb] = useState<ClimbPosition>(attempt.climb);
  const [extinguisher, setExtinguisher] = useState(attempt.extinguisher);
  const [minorFouls, setMinorFouls] = useState(attempt.minorFouls);
  const [majorFouls, setMajorFouls] = useState(attempt.majorFouls);
  const [card, setCard] = useState<CardType>(attempt.card);

  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [error, setError] = useState('');
  const [showing, setShowing] = useState(false);
  const [shown, setShown] = useState(false);
  const [going, setGoing] = useState(false);
  const [counting, setCounting] = useState(false);

  const score = skillsAttemptScore({
    suppression, humanBalls, climb, extinguisher, minorFouls, majorFouls, card,
  });

  const num = (value: number, set: (n: number) => void, max = MAX_BALLS) => (
    <input type="number" min={0} max={max} value={value}
      onWheel={(e) => e.currentTarget.blur()}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
      onChange={(e) => {
        const n = Math.trunc(Number(e.target.value));
        set(Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0);
      }}
      className="w-28 px-3 py-2 rounded-md bg-white text-gray-900 border border-gray-300 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
  );

  async function save({ confirmed = false } = {}) {
    if (saving || resetting) return;
    if (!attempt.played && !confirmed) { setConfirming(true); return; }
    setConfirming(false);
    setSaving(true);
    setStatus('idle');
    try {
      const res = await fetch(`/api/admin/skills/${attempt.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suppression, humanBalls, climb, extinguisher, minorFouls, majorFouls, card,
        }),
      });
      if (res.ok) { setStatus('ok'); router.refresh(); }
      else {
        const data = await res.json().catch(() => ({}));
        setStatus('error');
        setError(data.error ?? `Could not save (status ${res.status})`);
      }
    } catch {
      setStatus('error');
      setError('Could not save — check the connection and try again');
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (saving || resetting) return;
    if (!window.confirm(`Clear the result for ${attempt.teamName}, attempt ${attempt.round}?`)) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/skills/${attempt.id}`, { method: 'DELETE' });
      if (res.ok) { setStatus('idle'); router.refresh(); }
      else { setStatus('error'); setError('Could not clear the result'); }
    } catch {
      setStatus('error');
      setError('Could not clear the result — check the connection');
    } finally {
      setResetting(false);
    }
  }

  async function preview() {
    if (showing) return;
    setShowing(true);
    try {
      const res = await fetch('/api/admin/display/skills', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: attempt.id }),
      });
      setShown(res.ok);
      if (res.ok) setTimeout(() => setShown(false), 4000);
    } finally {
      setShowing(false);
    }
  }

  async function start() {
    if (going) return;
    setGoing(true);
    try {
      const res = await fetch('/api/admin/display/skills-go', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: attempt.id }),
      });
      if (res.ok) { setCounting(true); setTimeout(() => setCounting(false), 4000); }
      else {
        const data = await res.json().catch(() => ({}));
        setStatus('error');
        setError(data.error ?? 'Could not start the clock');
      }
    } finally {
      setGoing(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-semibold text-gray-900">
          {attempt.teamName} · attempt {attempt.round}
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${
          attempt.alliance === 'red'
            ? 'text-red-700 border-red-300 bg-red-50'
            : 'text-blue-700 border-blue-300 bg-blue-50'
        }`}>
          {attempt.alliance === 'red' ? 'Red side' : 'Blue side'}
        </span>
        {attempt.played
          ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Scored</span>
          : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">Not scored</span>}
        {shown && <span className="ml-auto text-sm text-green-700">✓ Shown on display</span>}
        {counting && <span className="text-sm text-green-700">✓ Counting down</span>}
        <button onClick={preview} disabled={showing}
          className={`${shown || counting ? '' : 'ml-auto'} px-3 py-1 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50`}>
          {showing ? 'Showing…' : 'Preview on display'}
        </button>
        <button onClick={start} disabled={going}
          className="px-4 py-1 rounded-md bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-50">
          {going ? 'Starting…' : 'Start attempt ▶'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
        <label className="flex justify-between items-center">
          Robot balls (1 point each) {num(suppression, setSuppression)}
        </label>
        <label className="flex justify-between items-center">
          Human player balls ({HUMAN_BALL_POINTS} points each) {num(humanBalls, setHumanBalls)}
        </label>
        <label className="flex justify-between items-center">
          Climb
          <select value={climb} onChange={(e) => setClimb(e.target.value as ClimbPosition)}
            className="w-28 px-2 py-2 rounded-md bg-white text-gray-900 border border-gray-300">
            {CLIMBS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="flex justify-between items-center">
          Card
          <select value={card} onChange={(e) => setCard(e.target.value as CardType)}
            className="w-28 px-2 py-2 rounded-md bg-white text-gray-900 border border-gray-300">
            {CARDS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="flex justify-between items-center">Extinguisher {num(extinguisher, setExtinguisher)}</label>
        <label className="flex justify-between items-center">Minor fouls {num(minorFouls, setMinorFouls, MAX_FOULS)}</label>
        <label className="flex justify-between items-center">Major fouls {num(majorFouls, setMajorFouls, MAX_FOULS)}</label>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <div className="text-sm">
          <span className="font-mono text-lg text-gray-900">{score}</span>
          <span className="text-gray-500 ml-3">
            {suppression} + {humanBalls}×{HUMAN_BALL_POINTS} balls
            {climb !== 'none' && ` · climb ${climb}`}
            {card === 'red' && ' · red card zeroes the attempt'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {status === 'ok' && <span className="text-sm text-green-600">✓ Saved</span>}
          {status === 'error' && (
            <span className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
              Error: {error}
            </span>
          )}
          {attempt.played && (
            <button onClick={reset} disabled={saving || resetting}
              className="px-4 py-2 rounded-md bg-white text-red-600 font-semibold border border-red-300 hover:bg-red-50 disabled:opacity-50">
              {resetting ? 'Clearing…' : 'Reset'}
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
            <strong>{attempt.teamName}, attempt {attempt.round}</strong> has not been scored yet.
            Saving records {score} points for this attempt.
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

      {status === 'ok' && nextAttempt && (
        <div className="border-t border-gray-100 pt-4 flex flex-col items-center gap-2">
          <span className="text-sm text-green-700">✓ Saved</span>
          <button onClick={() => router.push(`/admin/skills/${nextAttempt.id}`)}
            className="px-5 py-2 rounded-md bg-blue-600 text-white font-bold hover:bg-blue-700">
            Next: {nextAttempt.label} →
          </button>
        </div>
      )}
      {status === 'ok' && !nextAttempt && (
        <p className="border-t border-gray-100 pt-4 text-center text-sm text-gray-500">
          ✓ Saved — every skills attempt has been scored
        </p>
      )}
    </div>
  );
}
