'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface MatchListRow {
  id: number; number: number; phase: string; played: boolean;
  red: string[]; blue: string[]; redScore: number | null; blueScore: number | null;
}

export default function MatchList({ matches }: { matches: MatchListRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const isHit = (m: MatchListRow) =>
    q.length > 0 && (m.red.some((n) => n.toLowerCase().includes(q)) || m.blue.some((n) => n.toLowerCase().includes(q)));
  const totalHits = q ? matches.filter(isHit).length : 0;

  const playoffMatches = matches.filter((m) => m.phase === 'playoff');
  const qualMatches = matches.filter((m) => m.phase !== 'playoff');
  // Qualification always finishes before a playoff bracket can be generated,
  // so an unplayed qual match is always "next" before any playoff match.
  const nextId = (qualMatches.find((m) => !m.played) ?? playoffMatches.find((m) => !m.played))?.id;

  const openMatch = (id: number) => router.push(`/admin/matches/${id}`);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-3 border-b border-gray-200">
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
        <MatchGroup title="Playoffs" rows={playoffMatches} highlight isHit={isHit} nextId={nextId} onOpen={openMatch} />
      )}
      <MatchGroup title="Qualification" rows={qualMatches} isHit={isHit} nextId={nextId} onOpen={openMatch} />
    </div>
  );
}

function MatchGroup({ title, rows, highlight = false, isHit, nextId, onOpen }: {
  title: string;
  rows: MatchListRow[];
  highlight?: boolean;
  isHit: (m: MatchListRow) => boolean;
  nextId: number | undefined;
  onOpen: (id: number) => void;
}) {
  return (
    <div>
      <div className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${highlight ? 'text-amber-700 bg-amber-50 border-y border-amber-200' : 'text-gray-500 bg-gray-50 border-y border-gray-200'}`}>
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
              <th className="text-left px-3 sm:px-4 py-2 w-20 sm:w-24">Match</th>
              <th className="text-left px-3 sm:px-4 py-2">Red alliance</th>
              <th className="text-center px-3 sm:px-4 py-2 w-24 sm:w-32">Score</th>
              <th className="text-left px-3 sm:px-4 py-2">Blue alliance</th>
              <th className="text-center px-3 sm:px-4 py-2 w-28">Status</th>
              <th className="px-3 sm:px-4 py-2 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-sm text-gray-300">No matches</td></tr>
            )}
            {rows.map((m) => {
              const phaseLabel = `${m.phase === 'playoff' ? 'P' : 'Q'}${m.number}`;
              const redWins = m.played && m.redScore !== null && m.blueScore !== null && m.redScore > m.blueScore;
              const blueWins = m.played && m.redScore !== null && m.blueScore !== null && m.blueScore > m.redScore;
              const isNext = m.id === nextId;
              const hit = isHit(m);
              return (
                <tr key={m.id} onClick={() => onOpen(m.id)}
                  className={`cursor-pointer transition-colors ${
                    hit ? 'bg-yellow-100 ring-2 ring-yellow-300 ring-inset'
                      : isNext ? 'bg-blue-50 border-l-4 border-l-blue-500'
                        : 'hover:bg-gray-50'
                  }`}>
                  <td className="px-3 sm:px-4 py-2 sm:py-2.5 whitespace-nowrap">
                    <span className="font-mono font-black text-gray-900 text-xs sm:text-sm">{phaseLabel}</span>
                    {isNext && (
                      <span className="ml-1.5 text-[9px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                        Next
                      </span>
                    )}
                  </td>
                  <td className="px-3 sm:px-4 py-2 sm:py-2.5">
                    <span className={`text-red-600 text-xs sm:text-sm ${redWins ? 'font-black' : 'font-medium'}`}>{m.red.join(' · ')}</span>
                  </td>
                  <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-center">
                    {m.played
                      ? <span className="font-mono font-bold text-gray-900 text-xs sm:text-sm">{m.redScore} : {m.blueScore}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 sm:px-4 py-2 sm:py-2.5">
                    <span className={`text-blue-600 text-xs sm:text-sm ${blueWins ? 'font-black' : 'font-medium'}`}>{m.blue.join(' · ')}</span>
                  </td>
                  <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-center">
                    {m.played
                      ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Played</span>
                      : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Not played</span>}
                  </td>
                  <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-right">
                    <button onClick={(e) => { e.stopPropagation(); onOpen(m.id); }}
                      className="px-3 py-1.5 rounded-md text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-100">
                      {m.played ? 'Edit' : 'Open'}
                    </button>
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
