'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { computeMatchScores } from '@/lib/scoring/match';
import type { ClimbPosition, CardType } from '@/lib/scoring/types';
import type { MatchRow } from '@/lib/db/matches';

const CLIMBS: { value: ClimbPosition; label: string }[] = [
  { value: 'none', label: 'нет' }, { value: 'contact', label: 'контакт' },
  { value: 'zone1', label: 'зона 1' }, { value: 'zone2', label: 'зона 2' },
  { value: 'zone3', label: 'зона 3' },
];
const CARDS: CardType[] = ['none', 'yellow', 'white', 'red'];

// Пределы значений — те же, что проверяет matchResultSchema на сервере.
// Ограничиваем ввод здесь, чтобы поле не принимало то, что API всё равно отклонит.
const MAX_WILDFIRE = 500; // suppression, extinguisher
const MAX_PARTNER_CLIMB = 2;
const MAX_FOULS = 20;

type Trio<T> = [T, T, T];

export default function MatchForm({ match, teamNames }: {
  match: MatchRow; teamNames: Record<number, string>;
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

  // Any edit after a save invalidates that save's confirmation — a stale
  // "✓ Сохранено" next to a value the judge just changed would tell them
  // an unsent correction is already safe, which is worse than no indicator.
  function markDirty() {
    setSaveStatus('idle');
    setSaveError('');
  }

  const preview = computeMatchScores({
    extinguisher,
    red: { suppression: suppressionRed, climbs: climbRed, partnerClimbs: partnerRed,
           minorFouls: minorRed, majorFouls: majorRed },
    blue: { suppression: suppressionBlue, climbs: climbBlue, partnerClimbs: partnerBlue,
            minorFouls: minorBlue, majorFouls: majorBlue },
  });

  async function save() {
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
        setSaveError(data.error ?? `Не удалось сохранить (код ${res.status})`);
      }
    } catch {
      setSaveStatus('error');
      setSaveError('Не удалось сохранить — проверьте соединение и попробуйте ещё раз');
    } finally {
      setSaving(false);
    }
  }

  const num = (v: number, set: (n: number) => void, max = MAX_WILDFIRE) => (
    <input type="number" min={0} max={max} value={v}
      onChange={(e) => {
        const n = Math.trunc(Number(e.target.value));
        set(Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0);
        markDirty();
      }}
      className="w-24 px-2 py-1 rounded bg-slate-800 border border-slate-700" />
  );

  const side = (
    color: 'red' | 'blue', teams: number[],
    climbs: Trio<ClimbPosition>, setClimbs: (t: Trio<ClimbPosition>) => void,
    cards: Trio<CardType>, setCards: (t: Trio<CardType>) => void,
  ) => (
    <div className={`space-y-2 p-4 rounded ${color === 'red' ? 'bg-red-950/40' : 'bg-blue-950/40'}`}>
      {teams.map((teamId, i) => (
        <div key={teamId} className="flex items-center gap-2">
          <span className="w-40 truncate">{teamNames[teamId] ?? teamId}</span>
          <select value={climbs[i]}
            onChange={(e) => {
              const next = [...climbs] as Trio<ClimbPosition>;
              next[i] = e.target.value as ClimbPosition; setClimbs(next);
              markDirty();
            }}
            className="px-2 py-1 rounded bg-slate-800 border border-slate-700">
            {CLIMBS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={cards[i]}
            onChange={(e) => {
              const next = [...cards] as Trio<CardType>;
              next[i] = e.target.value as CardType; setCards(next);
              markDirty();
            }}
            className="px-2 py-1 rounded bg-slate-800 border border-slate-700">
            {CARDS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      ))}
    </div>
  );

  return (
    <div className="bg-slate-900 rounded-lg p-6 space-y-4">
      <h3 className="font-semibold">Матч {match.match_number}</h3>

      <div className="grid grid-cols-2 gap-4">
        {side('red', [match.red1_id, match.red2_id, match.red3_id], climbRed, setClimbRed, cardRed, setCardRed)}
        {side('blue', [match.blue1_id, match.blue2_id, match.blue3_id], climbBlue, setClimbBlue, cardBlue, setCardBlue)}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <label className="flex justify-between items-center">Suppression красных {num(suppressionRed, setSuppressionRed)}</label>
        <label className="flex justify-between items-center">Suppression синих {num(suppressionBlue, setSuppressionBlue)}</label>
        <label className="flex justify-between items-center">Partner climbs красных {num(partnerRed, setPartnerRed, MAX_PARTNER_CLIMB)}</label>
        <label className="flex justify-between items-center">Partner climbs синих {num(partnerBlue, setPartnerBlue, MAX_PARTNER_CLIMB)}</label>
        <label className="flex justify-between items-center">Minor фолы красных {num(minorRed, setMinorRed, MAX_FOULS)}</label>
        <label className="flex justify-between items-center">Minor фолы синих {num(minorBlue, setMinorBlue, MAX_FOULS)}</label>
        <label className="flex justify-between items-center">Major фолы красных {num(majorRed, setMajorRed, MAX_FOULS)}</label>
        <label className="flex justify-between items-center">Major фолы синих {num(majorBlue, setMajorBlue, MAX_FOULS)}</label>
        <label className="flex justify-between items-center col-span-2">
          Extinguisher (общий) {num(extinguisher, setExtinguisher)}
        </label>
      </div>

      <div className="flex items-center justify-between border-t border-slate-800 pt-4">
        <div className="text-sm">
          <span className="text-red-400 font-mono text-lg">{preview.red}</span>
          <span className="text-slate-500"> : </span>
          <span className="text-blue-400 font-mono text-lg">{preview.blue}</span>
          <span className="text-slate-500 ml-4">
            множители {preview.redMultiplier.toFixed(2)} / {preview.blueMultiplier.toFixed(2)} ·
            coopertition {preview.coopertition}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'ok' && (
            <span className="text-sm text-green-400">✓ Сохранено</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-sm text-red-400">Ошибка: {saveError}</span>
          )}
          <button onClick={save} disabled={saving}
            className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-500 disabled:opacity-50">
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
