'use client';
import { useEffect, useRef, useState } from 'react';
import StandingsTable from '../StandingsTable';

interface AllianceLineup { teams: string[] }
interface AllianceResult extends AllianceLineup { score: number }

type DisplayPayload =
  | { phase: 'standings' }
  | { phase: 'live'; matchNumber: number; matchPhase: 'qualification' | 'playoff'; red: AllianceLineup; blue: AllianceLineup }
  | { phase: 'result'; matchNumber: number; matchPhase: 'qualification' | 'playoff'; red: AllianceResult; blue: AllianceResult; winner: 'red' | 'blue' | 'tie' };

const POLL_MS = 3000;

export default function DisplayPage() {
  const [data, setData] = useState<DisplayPayload | null>(null);
  const latestRequestId = useRef(0);

  useEffect(() => {
    const load = () => {
      const requestId = ++latestRequestId.current;
      fetch('/api/display/state', { cache: 'no-store' })
        .then((r) => r.json())
        .then((json) => { if (latestRequestId.current === requestId) setData(json); })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 h-14 sm:h-16 flex items-center px-4 sm:px-8">
        <div>
          <h1 className="text-lg sm:text-xl font-bold leading-tight">FGC Uzbekistan 2026</h1>
          <p className="text-xs text-gray-500 leading-tight">Igniting Innovation · live results and rankings</p>
        </div>
      </header>
      <main className="p-4 sm:p-8">
        {!data && <p className="text-gray-400">Loading…</p>}
        {data?.phase === 'standings' && <StandingsTable />}
        {data && data.phase !== 'standings' && <MatchDisplay data={data} />}
      </main>
    </div>
  );
}

function MatchDisplay({ data }: { data: Extract<DisplayPayload, { phase: 'live' | 'result' }> }) {
  const label = `${data.matchPhase === 'playoff' ? 'Playoff' : 'Qualification'} match ${data.matchNumber}`;
  const isResult = data.phase === 'result';

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-center">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">{label}</p>
        <p className="text-2xl sm:text-3xl font-bold mt-1">
          {isResult ? 'Match result' : 'Now playing'}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <AllianceCard color="red" label="Red Alliance" data={data.red}
          isWinner={isResult && (data as Extract<DisplayPayload, { phase: 'result' }>).winner === 'red'} />
        <AllianceCard color="blue" label="Blue Alliance" data={data.blue}
          isWinner={isResult && (data as Extract<DisplayPayload, { phase: 'result' }>).winner === 'blue'} />
      </div>
      {isResult && (data as Extract<DisplayPayload, { phase: 'result' }>).winner === 'tie' && (
        <p className="text-lg font-bold text-gray-500 uppercase tracking-widest">Tie</p>
      )}
    </div>
  );
}

function AllianceCard({ color, label, data, isWinner }: {
  color: 'red' | 'blue'; label: string; data: AllianceLineup | AllianceResult; isWinner: boolean;
}) {
  const score = 'score' in data ? data.score : null;
  const border = color === 'red' ? 'border-red-200' : 'border-blue-200';
  const bg = color === 'red' ? 'bg-red-50' : 'bg-blue-50';
  const text = color === 'red' ? 'text-red-700' : 'text-blue-700';

  return (
    <div className={`rounded-xl border-2 p-6 ${bg} ${border} ${isWinner ? 'ring-4 ring-amber-400' : ''}`}>
      <p className={`text-xs font-semibold uppercase tracking-widest ${text}`}>
        {label} {isWinner && '· Winner'}
      </p>
      <ul className="mt-3 space-y-1">
        {data.teams.map((name, i) => (
          <li key={i} className="text-lg sm:text-2xl font-semibold text-gray-900">{name}</li>
        ))}
      </ul>
      {score !== null && (
        <p className={`mt-4 font-mono font-black text-5xl sm:text-6xl ${text}`}>{score}</p>
      )}
    </div>
  );
}
