'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { nextPicker, isPickable } from '@/lib/alliances/selection';
import type { SelectionState } from '@/lib/alliances/selection';

interface PlayoffStatus { matches: number; played: number }

export default function AlliancePicker({ teamNames }: { teamNames: Record<number, string> }) {
  const router = useRouter();
  const [state, setState] = useState<SelectionState | null>(null);
  const [ranked, setRanked] = useState<number[]>([]);
  const [playoff, setPlayoff] = useState<PlayoffStatus | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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
          setError('');
        } else {
          setState(null);
          setError(alliances.data.error ?? `Не удалось загрузить данные (код ${alliances.res.status})`);
        }
        setPlayoff(playoffStatus.res.ok
          ? { matches: playoffStatus.data.matches, played: playoffStatus.data.played }
          : null);
      })
      .catch(() => {
        setState(null);
        setError('Не удалось загрузить данные — проверьте соединение и попробуйте ещё раз');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function pick(teamId: number) {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/alliances', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setState(data.state);
      else setError(data.error ?? `Не удалось выполнить выбор (код ${res.status})`);
    } catch {
      setError('Не удалось выполнить выбор — проверьте соединение и попробуйте ещё раз');
    } finally {
      setBusy(false);
    }
  }

  // There is no per-pick undo, so this is the one chance to catch a misclick:
  // during a live ceremony this button sits right below the picker buttons,
  // and it discards every pick made so far with no way back.
  function reset() {
    const madePicks = state?.reduce((acc, a) => acc + a.picks.length, 0) ?? 0;
    const ok = window.confirm(
      madePicks > 0
        ? `Сбросить весь выбор альянсов? Будут потеряны все сделанные выборы (${madePicks}) — отменить это будет нельзя.`
        : 'Сбросить выбор альянсов?',
    );
    if (ok) performReset();
  }

  async function performReset() {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/alliances', { method: 'DELETE' });
      if (res.ok) {
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Не удалось сбросить выбор (код ${res.status})`);
      }
    } catch {
      setError('Не удалось сбросить выбор — проверьте соединение и попробуйте ещё раз');
    } finally {
      setBusy(false);
    }
  }

  async function generatePlayoff() {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/playoff', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? `Не удалось создать матчи плей-оффа (код ${res.status})`);
      else router.push('/admin/matches');
    } catch {
      setError('Не удалось создать матчи плей-оффа — проверьте соединение и попробуйте ещё раз');
    } finally {
      setBusy(false);
    }
  }

  // Re-creation is the destructive path: only offered while the server would
  // still allow it (no playoff match played yet), and only after the operator
  // confirms exactly what gets deleted. The server re-checks this regardless
  // — this dialog is a courtesy, not the safeguard.
  function regeneratePlayoff() {
    const count = playoff?.matches ?? 0;
    const ok = window.confirm(
      `Это удалит все текущие матчи плей-офф (${count}) и создаст сетку заново. Продолжить?`,
    );
    if (ok) generatePlayoff();
  }

  if (loading) return <p className="text-slate-400">Загрузка…</p>;

  if (!state) {
    return (
      <div className="space-y-4">
        <p className="text-red-400 text-sm" role="alert">{error || 'Не удалось загрузить данные'}</p>
        <button onClick={load} className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-sm">
          Повторить
        </button>
      </div>
    );
  }

  const picker = nextPicker(state);
  const taken = new Set(state.flatMap((a) => [a.captain, ...a.picks]));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {state.map((a) => {
          // Captain of a LOWER-ranked alliance is the one legal exception to
          // "already-taken teams can't be picked" (see isPickable / applyPick):
          // the current picker may poach them, which promotes the next free
          // team by ranking into the vacated captaincy.
          const captainPoachable = picker !== null && isPickable(state, picker, a.captain);
          return (
            <div key={a.seed}
              className={`p-4 rounded-lg bg-slate-900 ${picker === a.seed - 1 ? 'ring-2 ring-orange-500' : ''}`}>
              <h3 className="font-semibold mb-2">Альянс {a.seed}</h3>
              {captainPoachable ? (
                <button onClick={() => pick(a.captain)} disabled={busy}
                  className="w-full text-left text-sm p-2 -mx-1 rounded border border-amber-500 bg-amber-950/40 hover:bg-amber-900/50 disabled:opacity-50">
                  <span className="block text-amber-400 font-medium">
                    ⇪ Переманить капитана: {teamNames[a.captain] ?? a.captain}
                  </span>
                  <span className="block text-xs text-amber-200/80 mt-0.5">
                    Перейдёт в выбирающий альянс; капитаном альянса {a.seed} станет
                    следующая свободная команда по рейтингу
                  </span>
                </button>
              ) : (
                <p className="text-sm">Капитан: {teamNames[a.captain] ?? a.captain}</p>
              )}
              {a.picks.map((p, i) => (
                <p key={p} className="text-sm text-slate-400">Пик {i + 1}: {teamNames[p] ?? p}</p>
              ))}
            </div>
          );
        })}
      </div>

      {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

      {picker !== null ? (
        <section className="bg-slate-900 rounded-lg p-6">
          <h3 className="font-semibold mb-3">Выбирает альянс {picker + 1}</h3>
          <div className="flex flex-wrap gap-2">
            {ranked.filter((id) => !taken.has(id)).map((id) => (
              <button key={id} onClick={() => pick(id)} disabled={busy}
                className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-sm disabled:opacity-50">
                {teamNames[id] ?? id}
              </button>
            ))}
          </div>
        </section>
      ) : playoff && playoff.matches > 0 ? (
        <div className="bg-slate-900 rounded-lg p-4 space-y-2">
          <p className="text-sm text-slate-300">
            Матчи плей-оффа созданы: {playoff.matches}, сыграно: {playoff.played}
          </p>
          {playoff.played === 0 ? (
            <button onClick={regeneratePlayoff} disabled={busy}
              className="px-3 py-1.5 rounded border border-slate-700 text-slate-400 text-xs hover:text-slate-200 hover:border-slate-500 disabled:opacity-50">
              {busy ? 'Пересоздание…' : 'Пересоздать сетку плей-оффа заново'}
            </button>
          ) : (
            <p className="text-xs text-slate-500">
              Пересоздание недоступно — есть сыгранные матчи плей-оффа
            </p>
          )}
        </div>
      ) : (
        <button onClick={generatePlayoff} disabled={busy}
          className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-500 disabled:opacity-50">
          {busy ? 'Создание…' : 'Создать матчи плей-оффа'}
        </button>
      )}

      <button onClick={reset} disabled={busy}
        className="text-sm text-slate-500 hover:text-slate-300 disabled:opacity-50">
        Сбросить выбор альянсов
      </button>
    </div>
  );
}
