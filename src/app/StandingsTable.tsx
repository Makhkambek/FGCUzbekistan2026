'use client';
import { useEffect, useState } from 'react';

interface Standing {
  teamId: number; name: string; rankingScore: number;
  played: number; best: number; suppressionTotal: number;
}
interface Match {
  id: number; number: number; phase: string; played: boolean;
  red: string[]; blue: string[]; redScore: number | null; blueScore: number | null;
}

export default function StandingsTable() {
  const [data, setData] = useState<{ standings: Standing[]; matches: Match[] } | null>(null);

  useEffect(() => {
    const load = () => fetch('/api/standings').then((r) => r.json()).then(setData).catch(() => {});
    load();
    const timer = setInterval(load, 10_000);
    return () => clearInterval(timer);
  }, []);

  if (!data) return <p className="text-slate-400">Загрузка…</p>;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-3">Рейтинг команд</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 border-b border-slate-800">
              <tr>
                <th className="text-left py-2 w-12">#</th>
                <th className="text-left py-2">Команда</th>
                <th className="text-right py-2">Рейтинг</th>
                <th className="text-right py-2">Матчей</th>
                <th className="text-right py-2">Лучший</th>
                <th className="text-right py-2">Suppression</th>
              </tr>
            </thead>
            <tbody>
              {data.standings.map((s, i) => (
                <tr key={s.teamId} className="border-b border-slate-900">
                  <td className="py-2 text-slate-500">{i + 1}</td>
                  <td className="py-2 font-medium">{s.name}</td>
                  <td className="py-2 text-right font-mono text-orange-400">
                    {s.played === 0 ? '—' : s.rankingScore.toFixed(1)}
                  </td>
                  <td className="py-2 text-right text-slate-400">{s.played}</td>
                  <td className="py-2 text-right text-slate-400">{s.best}</td>
                  <td className="py-2 text-right text-slate-400">{s.suppressionTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Матчи</h2>
        <div className="space-y-1">
          {data.matches.map((m) => (
            <div key={m.id} className="flex items-center gap-4 py-2 border-b border-slate-900 text-sm">
              <span className="w-16 text-slate-500">
                {m.phase === 'playoff' ? 'ПО' : 'К'}{m.number}
              </span>
              <span className="flex-1 text-red-400">{m.red.join(' · ')}</span>
              <span className="font-mono w-24 text-center">
                {m.played ? `${m.redScore} : ${m.blueScore}` : '—'}
              </span>
              <span className="flex-1 text-blue-400 text-right">{m.blue.join(' · ')}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
