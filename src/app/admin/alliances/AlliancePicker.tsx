'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { nextPicker } from '@/lib/alliances/selection';
import type { SelectionState } from '@/lib/alliances/selection';

export default function AlliancePicker({ teamNames }: { teamNames: Record<number, string> }) {
  const router = useRouter();
  const [state, setState] = useState<SelectionState | null>(null);
  const [ranked, setRanked] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  function load() {
    return fetch('/api/admin/alliances')
      .then((res) => res.json().catch(() => ({})).then((data) => {
        if (res.ok) {
          setState(data.state);
          setRanked(data.ranked);
          setError('');
        } else {
          setState(null);
          setError(data.error ?? `Не удалось загрузить данные (код ${res.status})`);
        }
      }))
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

  async function reset() {
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
        {state.map((a) => (
          <div key={a.seed}
            className={`p-4 rounded-lg bg-slate-900 ${picker === a.seed - 1 ? 'ring-2 ring-orange-500' : ''}`}>
            <h3 className="font-semibold mb-2">Альянс {a.seed}</h3>
            <p className="text-sm">Капитан: {teamNames[a.captain] ?? a.captain}</p>
            {a.picks.map((p, i) => (
              <p key={p} className="text-sm text-slate-400">Пик {i + 1}: {teamNames[p] ?? p}</p>
            ))}
          </div>
        ))}
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
