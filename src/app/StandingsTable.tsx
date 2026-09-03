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

function MatchSection({ title, rows, highlight = false, isHit }: {
  title: string;
  rows: Match[];
  highlight?: boolean;
  isHit: (m: Match) => boolean;
}) {
  return (
    <div>
      <div className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${highlight ? 'text-amber-700 bg-amber-50 border-y border-amber-200' : 'text-gray-500 bg-gray-50 border-y border-gray-200'}`}>
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
              <th className="text-left px-3 sm:px-4 py-2 w-20 sm:w-24">Match</th>
              <th className="text-left px-3 sm:px-4 py-2">Red alliance</th>
              <th className="text-center px-3 sm:px-4 py-2 w-24 sm:w-32">Score</th>
              <th className="text-right px-3 sm:px-4 py-2">Blue alliance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((m) => {
              const phaseLabel = `${m.phase === 'playoff' ? 'P' : 'Q'}${m.number}`;
              const redWins = m.played && m.redScore !== null && m.blueScore !== null && m.redScore > m.blueScore;
              const blueWins = m.played && m.redScore !== null && m.blueScore !== null && m.blueScore > m.redScore;
              const hit = isHit(m);
              return (
                <tr key={m.id} className={hit ? 'bg-yellow-100 ring-2 ring-yellow-300 ring-inset' : 'hover:bg-gray-50'}>
                  <td className="px-3 sm:px-4 py-2 sm:py-2.5 whitespace-nowrap">
                    <span className="font-mono font-black text-gray-900 text-xs sm:text-sm">{phaseLabel}</span>
                  </td>
                  <td className="px-3 sm:px-4 py-2 sm:py-2.5">
                    <span className={`text-red-600 text-xs sm:text-sm ${redWins ? 'font-black' : 'font-medium'}`}>{m.red.join(' · ')}</span>
                  </td>
                  <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-center">
                    {m.played
                      ? <span className="font-mono font-bold text-gray-900 text-xs sm:text-sm">{m.redScore} : {m.blueScore}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-right">
                    <span className={`text-blue-600 text-xs sm:text-sm ${blueWins ? 'font-black' : 'font-medium'}`}>{m.blue.join(' · ')}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function StandingsTable() {
  const [data, setData] = useState<{ standings: Standing[]; matches: Match[] } | null>(null);
  const [view, setView] = useState<'standings' | 'matches'>('standings');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [query, setQuery] = useState('');
  // The 10s polls are not guaranteed to come back in order: a delayed request
  // can land after a fresher one and overwrite current data with stale data.
  // A monotonic request id fixes that — apply a response only while it is
  // still the most recently started request.
  const latestRequestId = useRef(0);
  // Nothing on screen used to distinguish "the score has not changed" from
  // "the server has been unreachable for a minute" — the badge said `live`
  // either way. The hall would keep reading a frozen scoreboard.
  const [stale, setStale] = useState(false);
  const lastSuccessAt = useRef(Date.now());

  useEffect(() => {
    let currentController: AbortController | null = null;

    const load = () => {
      const requestId = ++latestRequestId.current;
      currentController?.abort();
      const controller = new AbortController();
      currentController = controller;

      fetch('/api/standings', { signal: controller.signal })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((json) => {
          if (latestRequestId.current === requestId) {
            setData(json);
            setLastUpdate(new Date());
            lastSuccessAt.current = Date.now();
            setStale(false);
          }
        })
        .catch(() => {
          // An aborted request is not a failure — the newer one it made way
          // for will refresh the timestamp.
        });
    };

    load();
    const timer = setInterval(load, 10_000);
    // Browsers throttle timers in background tabs, so a spectator coming back
    // to the tab would stare at a minute-old table until the next tick.
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    // 25s = two missed polls; short enough to notice, long enough not to
    // flicker on one slow response.
    const staleTimer = setInterval(
      () => setStale(Date.now() - lastSuccessAt.current > 25_000), 2_000);
    return () => {
      clearInterval(timer);
      clearInterval(staleTimer);
      document.removeEventListener('visibilitychange', onVisible);
      currentController?.abort();
    };
  }, []);

  if (!data) return <p className="text-gray-400">Loading…</p>;

  const q = query.trim().toLowerCase();
  const isHit = (m: Match) =>
    q.length > 0 && (m.red.some((n) => n.toLowerCase().includes(q)) || m.blue.some((n) => n.toLowerCase().includes(q)));
  const totalHits = q ? data.matches.filter(isHit).length : 0;
  const playoffMatches = data.matches.filter((m) => m.phase === 'playoff');
  const qualMatches = data.matches.filter((m) => m.phase !== 'playoff');

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-200 px-4">
        <div className="flex gap-1">
          <button
            onClick={() => setView('standings')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 -mb-px uppercase tracking-wider transition-colors ${
              view === 'standings' ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-700'
            }`}
          >
            Team rankings
          </button>
          <button
            onClick={() => setView('matches')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 -mb-px uppercase tracking-wider transition-colors ${
              view === 'matches' ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-700'
            }`}
          >
            Matches
          </button>
        </div>
        {lastUpdate && (
          stale
            ? <span className="text-[10px] text-red-600 font-semibold">
                NO CONNECTION · last update {lastUpdate.toLocaleTimeString()}
              </span>
            : <span className="text-[10px] text-green-600 font-semibold animate-pulse">live</span>
        )}
      </div>

      {view === 'standings' ? (
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
      ) : (
        <div className="px-1 sm:px-2">
          <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-3">
            <div className="text-xs text-gray-400">
              {q.length > 0 && <span className="font-semibold text-gray-600">Found {totalHits}</span>}
            </div>
            <div className="relative w-full max-w-[260px] sm:max-w-xs">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search teams…"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" />
              </svg>
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600 text-sm">
                  ✕
                </button>
              )}
            </div>
          </div>
          {playoffMatches.length > 0 && (
            <MatchSection title="Playoffs" rows={playoffMatches} highlight isHit={isHit} />
          )}
          <MatchSection title="Qualification" rows={qualMatches} isHit={isHit} />
        </div>
      )}
    </div>
  );
}
