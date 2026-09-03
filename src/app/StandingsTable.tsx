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
  // The 10s polls are not guaranteed to come back in order: a delayed request
  // can land after a fresher one and overwrite current data with stale data.
  // A monotonic request id fixes that — apply a response only while it is
  // still the most recently started request.
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

  if (!data) return <p className="text-gray-400">Loading…</p>;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-3 text-gray-900">Team rankings</h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] border-collapse">
              <thead>
                <tr>
                  <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 w-8">#</th>
                  <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">Team</th>
                  <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">Ranking score</th>
                  <th className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">Played</th>
                  <th className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">Best</th>
                  <th className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">Suppression</th>
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
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-gray-900">Matches</h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          {data.matches.map((m) => {
            const phaseLabel = `${m.phase === 'playoff' ? 'P' : 'Q'}${m.number}`;
            const score = m.played
              ? <span className="font-mono text-sm md:text-base lg:text-lg text-gray-900 whitespace-nowrap">{m.redScore} : {m.blueScore}</span>
              : <span className="font-mono text-sm md:text-base lg:text-lg text-gray-400 italic">—</span>;
            return (
              <div key={m.id} className="hover:bg-gray-50 px-4 sm:px-6 py-3">
                {/* Phone: red line-up, score, blue line-up stacked — each stays on its own readable line
                    instead of being squeezed into a narrow side-by-side column. */}
                <div className="sm:hidden space-y-1">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-400 font-mono text-xs">{phaseLabel}</span>
                    {score}
                  </div>
                  <div className="text-red-600 font-medium text-sm">{m.red.join(' · ')}</div>
                  <div className="text-blue-600 font-medium text-sm">{m.blue.join(' · ')}</div>
                </div>
                {/* Wide screens: left/centre/right row. */}
                <div className="hidden sm:flex sm:items-center gap-4 text-base md:text-lg">
                  <span className="w-16 flex-shrink-0 text-gray-400 font-mono text-sm md:text-base lg:text-lg">{phaseLabel}</span>
                  <span className="flex-1 min-w-0 text-red-600 font-medium text-sm md:text-base lg:text-lg">{m.red.join(' · ')}</span>
                  <span className="min-w-[6.5rem] flex-shrink-0 text-center">{score}</span>
                  <span className="flex-1 min-w-0 text-blue-600 font-medium text-sm md:text-base lg:text-lg text-right">{m.blue.join(' · ')}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
