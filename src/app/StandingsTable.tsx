'use client';
import { useEffect, useRef, useState } from 'react';

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
  // Опросы каждые 10с не гарантированно приходят по порядку: если предыдущий
  // запрос задержался, его ответ может прилететь позже свежего и затереть
  // актуальные данные устаревшими. Монотонный id запроса решает это —
  // применяем ответ, только если это всё ещё самый последний запущенный запрос.
  const latestRequestId = useRef(0);

  useEffect(() => {
    let currentController: AbortController | null = null;

    const load = () => {
      const requestId = ++latestRequestId.current;
      currentController?.abort();
      const controller = new AbortController();
      currentController = controller;

      fetch('/api/standings', { signal: controller.signal })
        .then((r) => r.json())
        .then((json) => {
          if (latestRequestId.current === requestId) setData(json);
        })
        .catch(() => {});
    };

    load();
    const timer = setInterval(load, 10_000);
    return () => {
      clearInterval(timer);
      currentController?.abort();
    };
  }, []);

  if (!data) return <p className="text-gray-400">Загрузка…</p>;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-3 text-gray-900">Рейтинг команд</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse">
            <thead>
              <tr>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 w-8">#</th>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">Команда</th>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">Рейтинг</th>
                <th className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">Матчей</th>
                <th className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">Лучший</th>
                <th className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">Подавление</th>
              </tr>
            </thead>
            <tbody className="text-base md:text-lg">
              {data.standings.map((s, i) => (
                <tr key={s.teamId} className="hover:bg-gray-50 border-b border-gray-100 last:border-0">
                  <td className="px-2 sm:px-6 py-2 sm:py-3 text-gray-400 w-8">{i + 1}</td>
                  <td className="px-2 sm:px-6 py-2 sm:py-3 text-blue-600 font-medium text-sm md:text-base lg:text-lg">{s.name}</td>
                  <td className="px-2 sm:px-6 py-2 sm:py-3">
                    {s.played === 0
                      ? <span className="text-gray-400 italic font-mono text-sm md:text-base lg:text-lg">—</span>
                      : <strong className="font-mono text-sm md:text-base lg:text-lg">{s.rankingScore.toFixed(1)}</strong>}
                  </td>
                  <td className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 font-mono text-sm md:text-base lg:text-lg text-gray-500">{s.played}</td>
                  <td className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 font-mono text-sm md:text-base lg:text-lg text-gray-500">{s.best}</td>
                  <td className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 font-mono text-sm md:text-base lg:text-lg text-gray-500">{s.suppressionTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-gray-900">Матчи</h2>
        <div className="space-y-1">
          {data.matches.map((m) => (
            <div key={m.id} className="flex items-center gap-4 py-2 border-b border-gray-100 last:border-0 text-base md:text-lg">
              <span className="w-16 text-gray-400 font-mono text-sm md:text-base lg:text-lg">
                {m.phase === 'playoff' ? 'ПО' : 'К'}{m.number}
              </span>
              <span className="flex-1 text-red-600 font-medium text-sm md:text-base lg:text-lg">{m.red.join(' · ')}</span>
              <span className="font-mono text-sm md:text-base lg:text-lg w-24 text-center text-gray-900">
                {m.played
                  ? `${m.redScore} : ${m.blueScore}`
                  : <span className="text-gray-400 italic">—</span>}
              </span>
              <span className="flex-1 text-blue-600 font-medium text-sm md:text-base lg:text-lg text-right">{m.blue.join(' · ')}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
