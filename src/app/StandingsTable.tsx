'use client';
import React, { useEffect, useRef, useState } from 'react';
import { matchLabel } from '@/lib/match-label';

interface Standing {
  teamId: number; name: string; rankingScore: number;
  played: number; best: number; suppressionTotal: number;
}
interface SkillsAttempt { round: number; score: number | null; played: boolean }
interface SkillsRow {
  teamId: number; name: string; total: number; best: number; attemptsPlayed: number;
  attempts: SkillsAttempt[];
}
interface Match {
  id: number; number: number; phase: string; played: boolean;
  red: string[]; blue: string[]; redScore: number | null; blueScore: number | null;
}

function MatchSection({ title, rows, highlight = false, roomy = false, isHit }: {
  title: string;
  rows: Match[];
  highlight?: boolean;
  /** Three finals in a table built for twelve qualification rows leaves half
   *  the screen blank; the shorter list can afford bigger type and more air. */
  roomy?: boolean;
  isHit: (m: Match) => boolean;
}) {
  return (
    <div>
      <div className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${highlight ? 'text-amber-700 bg-amber-50 border-y border-amber-200' : 'text-gray-500 bg-gray-50 border-y border-gray-200'}`}>
        {title}
      </div>
      {/* On a phone the four-column table could only fit by scrolling
          sideways, which reads as a broken page: the blue alliance sits off
          the edge and nobody thinks to drag it into view. Below `sm` each
          match becomes a stacked card instead — the same rows, no scrolling. */}
      <div className="sm:hidden divide-y divide-gray-100">
        {rows.map((m) => {
          const phaseLabel = matchLabel(m.phase === 'playoff' ? 'playoff' : 'qualification', m.number);
          const redWins = m.played && m.redScore !== null && m.blueScore !== null && m.redScore > m.blueScore;
          const blueWins = m.played && m.redScore !== null && m.blueScore !== null && m.blueScore > m.redScore;
          const hit = isHit(m);
          return (
            <div key={m.id} className={`px-3 py-2.5 ${hit ? 'bg-yellow-100 ring-2 ring-yellow-300 ring-inset' : ''}`}>
              <div className={`font-mono font-black ${!m.played ? 'text-gray-500' : redWins ? 'text-red-600' : blueWins ? 'text-blue-600' : 'text-emerald-600'} ${roomy ? 'text-xl' : 'text-sm'}`}>
                {phaseLabel}
                {m.played && !redWins && !blueWins && (
                  <span className="ml-2 text-[10px] font-sans uppercase tracking-wider text-emerald-600">tie</span>
                )}
              </div>
              <div className="mt-1.5 flex items-baseline gap-2 rounded bg-red-50 px-2 py-1">
                <span className={`grow text-red-700 text-sm ${redWins ? 'font-black' : 'font-medium'}`}>{m.red.join(' · ')}</span>
                {m.played
                  ? <span className={`shrink-0 font-mono text-red-900 ${redWins ? 'font-black' : 'font-medium'}`}>{m.redScore}</span>
                  : <span className="shrink-0 text-red-300">—</span>}
              </div>
              <div className="mt-1 flex items-baseline gap-2 rounded bg-blue-50 px-2 py-1">
                <span className={`grow text-blue-700 text-sm ${blueWins ? 'font-black' : 'font-medium'}`}>{m.blue.join(' · ')}</span>
                {m.played
                  ? <span className={`shrink-0 font-mono text-blue-900 ${blueWins ? 'font-black' : 'font-medium'}`}>{m.blueScore}</span>
                  : <span className="shrink-0 text-blue-300">—</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Laid out the way FIRST Global's own results page lays a match out:
          the label carries the winner's colour, each alliance sits in a block
          tinted its own colour, and the two scores are cells of their own at
          the end rather than one "123 : 45" string. Nothing has to be read to
          see who won — the eye lands on the bold number in the coloured cell. */}
      <div className="hidden sm:block overflow-x-auto">
        <table className={`w-full text-sm ${roomy ? 'min-w-[520px]' : 'min-w-[420px]'}`}>
          <tbody className="divide-y divide-gray-100">
            {rows.map((m) => {
              const phaseLabel = matchLabel(m.phase === 'playoff' ? 'playoff' : 'qualification', m.number);
              const redWins = m.played && m.redScore !== null && m.blueScore !== null && m.redScore > m.blueScore;
              const blueWins = m.played && m.redScore !== null && m.blueScore !== null && m.blueScore > m.redScore;
              const tie = m.played && m.redScore !== null && m.redScore === m.blueScore;
              const hit = isHit(m);
              const labelColour = !m.played ? 'text-gray-500'
                : redWins ? 'text-red-600' : blueWins ? 'text-blue-600' : 'text-emerald-600';
              return (
                <tr key={m.id} className={`${roomy ? '[&>td]:py-7 sm:[&>td]:py-12' : ''} ${hit ? 'bg-yellow-100 ring-2 ring-yellow-300 ring-inset' : ''}`}>
                  <td className="px-3 sm:px-4 py-2 sm:py-2.5 whitespace-nowrap w-24 sm:w-32">
                    <span className={`font-mono font-black ${labelColour} ${roomy ? 'text-xl sm:text-3xl' : 'text-xs sm:text-sm'}`}>
                      {phaseLabel}
                    </span>
                    {tie && <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-600">tie</span>}
                  </td>
                  <td className={`px-3 sm:px-4 py-2 sm:py-2.5 ${hit ? '' : 'bg-red-50/70'}`}>
                    <span className={`text-red-700 ${roomy ? 'text-base sm:text-xl' : 'text-xs sm:text-sm'} ${redWins ? 'font-black' : 'font-medium'}`}>{m.red.join(' · ')}</span>
                  </td>
                  <td className={`px-3 sm:px-4 py-2 sm:py-2.5 ${hit ? '' : 'bg-blue-50/70'}`}>
                    <span className={`text-blue-700 ${roomy ? 'text-base sm:text-xl' : 'text-xs sm:text-sm'} ${blueWins ? 'font-black' : 'font-medium'}`}>{m.blue.join(' · ')}</span>
                  </td>
                  <td className={`px-2 sm:px-3 py-2 sm:py-2.5 text-right w-14 sm:w-20 ${hit ? '' : 'bg-red-100/70'}`}>
                    {m.played
                      ? <span className={`font-mono text-red-900 ${redWins ? 'font-black' : 'font-medium'} ${roomy ? 'text-xl sm:text-3xl' : 'text-xs sm:text-sm'}`}>{m.redScore}</span>
                      : <span className="text-red-300">—</span>}
                  </td>
                  <td className={`px-2 sm:px-3 py-2 sm:py-2.5 text-right w-14 sm:w-20 ${hit ? '' : 'bg-blue-100/70'}`}>
                    {m.played
                      ? <span className={`font-mono text-blue-900 ${blueWins ? 'font-black' : 'font-medium'} ${roomy ? 'text-xl sm:text-3xl' : 'text-xs sm:text-sm'}`}>{m.blueScore}</span>
                      : <span className="text-blue-300">—</span>}
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
  const [data, setData] = useState<{ standings: Standing[]; matches: Match[]; skills?: SkillsRow[] } | null>(null);
  const [view, setView] = useState<'standings' | 'matches' | 'finals' | 'skills'>('standings');
  // Which team's attempts are open on the skills tab. One at a time: the point
  // of the tab is to look at a team, and three teams unfolded at once is the
  // long list the tab exists to avoid.
  const [openTeam, setOpenTeam] = useState<number | null>(null);
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
  // 0 until the first response — set inside the effect, since reading the
  // clock during render is not pure.
  const lastSuccessAt = useRef(0);

  useEffect(() => {
    let currentController: AbortController | null = null;

    lastSuccessAt.current = Date.now();
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

  if (!data) {
    // Before the first successful response there is no table to mark stale —
    // a spectator opening the page while the server is down used to sit on
    // "Loading…" with no hint that anything was wrong.
    return stale
      ? <p className="text-red-600 text-sm">No connection to the scoring server — retrying…</p>
      : <p className="text-gray-400">Loading…</p>;
  }

  const q = query.trim().toLowerCase();
  const isHit = (m: Match) =>
    q.length > 0 && (m.red.some((n) => n.toLowerCase().includes(q)) || m.blue.some((n) => n.toLowerCase().includes(q)));
  const playoffMatches = data.matches.filter((m) => m.phase === 'playoff');
  const qualMatches = data.matches.filter((m) => m.phase !== 'playoff');
  // The Finals tab disappears if the bracket is rebuilt away underneath a
  // spectator who is standing on it; without this they would be left staring
  // at an empty table with no tab highlighted.
  const skills = data.skills ?? [];
  const activeView = (view === 'finals' && playoffMatches.length === 0)
    || (view === 'skills' && skills.length === 0)
      ? 'matches' : view;
  const visibleMatches = activeView === 'finals' ? playoffMatches : qualMatches;
  // Counted over what this tab actually shows: "Found 3" while looking at a
  // list of one is worse than no count at all.
  const totalHits = q ? visibleMatches.filter(isHit).length : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-3 sm:px-4">
        {/* Four tabs do not fit across a phone: they used to wrap onto two
            lines and drop "Finals" off the edge. They stay on one line and
            scroll instead, which is what a tab strip is supposed to do. */}
        <div className="flex gap-1 overflow-x-auto whitespace-nowrap">
          <button
            onClick={() => setView('standings')}
            className={`shrink-0 px-2.5 sm:px-4 py-2.5 text-xs font-bold border-b-2 -mb-px uppercase tracking-wider transition-colors ${
              activeView === 'standings' ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-700'
            }`}
          >
            {/* "Rankings" is what FIRST Global's own results page calls this
                tab, and the short form is what lets four tabs fit a phone. */}
            <span className="sm:hidden">Rankings</span>
            <span className="hidden sm:inline">Team rankings</span>
          </button>
          <button
            onClick={() => setView('matches')}
            className={`shrink-0 px-2.5 sm:px-4 py-2.5 text-xs font-bold border-b-2 -mb-px uppercase tracking-wider transition-colors ${
              activeView === 'matches' ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-700'
            }`}
          >
            Matches
          </button>
          {/* The finals get their own tab, and only once they exist — an empty
              tab through the whole qualification day is just a dead end. */}
          {skills.length > 0 && (
            <button
              onClick={() => setView('skills')}
              className={`shrink-0 px-2.5 sm:px-4 py-2.5 text-xs font-bold border-b-2 -mb-px uppercase tracking-wider transition-colors ${
                activeView === 'skills' ? 'text-emerald-600 border-emerald-600' : 'text-gray-400 border-transparent hover:text-gray-700'
              }`}
            >
              Skills
            </button>
          )}
          {playoffMatches.length > 0 && (
            <button
              onClick={() => setView('finals')}
              className={`shrink-0 px-2.5 sm:px-4 py-2.5 text-xs font-bold border-b-2 -mb-px uppercase tracking-wider transition-colors ${
                activeView === 'finals' ? 'text-amber-600 border-amber-600' : 'text-gray-400 border-transparent hover:text-gray-700'
              }`}
            >
              Finals
            </button>
          )}
        </div>
        {lastUpdate && (
          stale
            // A lost connection is worth the space on any screen; a healthy
            // one is not, and on a phone the word "live" was eating the tab
            // beside it.
            ? <span className="shrink-0 text-[10px] text-red-600 font-semibold">
                <span className="sm:hidden">NO CONNECTION</span>
                <span className="hidden sm:inline">
                  NO CONNECTION · last update {lastUpdate.toLocaleTimeString()}
                </span>
              </span>
            : <span className="hidden sm:inline shrink-0 text-[10px] text-green-600 font-semibold animate-pulse">live</span>
        )}
      </div>

      {activeView === 'skills' ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse">
            <thead>
              <tr>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 w-8">#</th>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">Team</th>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-right text-xs font-semibold text-gray-500 border-b border-gray-200">Skills total</th>
                <th className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-semibold text-gray-500 border-b border-gray-200">Best attempt</th>
                <th className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-semibold text-gray-500 border-b border-gray-200">Attempts</th>
              </tr>
            </thead>
            <tbody className="text-base md:text-lg">
              {skills.map((s, i) => {
                const open = openTeam === s.teamId;
                return (
                  <React.Fragment key={s.teamId}>
                    <tr
                      onClick={() => setOpenTeam(open ? null : s.teamId)}
                      aria-expanded={open}
                      className={`cursor-pointer border-b border-gray-100 last:border-0 ${
                        open ? 'bg-emerald-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-2 sm:px-6 py-2 sm:py-3 text-gray-400 w-8">{i + 1}</td>
                      <td className="px-2 sm:px-6 py-2 sm:py-3 text-emerald-700 font-medium">
                        <span className={`inline-block mr-2 text-xs text-emerald-500 transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
                        {s.name}
                      </td>
                      <td className="px-2 sm:px-6 py-2 sm:py-3 text-right"><strong className="font-mono">{s.total}</strong></td>
                      <td className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-right font-mono text-gray-500">{s.best}</td>
                      <td className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-right font-mono text-gray-500">{s.attemptsPlayed}</td>
                    </tr>
                    {open && (
                      <tr className="border-b border-gray-100 last:border-0">
                        <td colSpan={5} className="px-2 sm:px-6 py-3 bg-emerald-50/60">
                          <div className="grid gap-2 sm:grid-cols-3">
                            {s.attempts.map((a) => (
                              <div key={a.round} className="flex items-baseline justify-between gap-3 px-3 py-2 rounded-lg bg-white border border-emerald-100">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  Attempt {a.round}
                                </span>
                                <span className={`font-mono ${a.played ? 'font-bold text-gray-900' : 'text-gray-300'}`}>
                                  {a.played ? a.score : '—'}
                                </span>
                              </div>
                            ))}
                          </div>
                          {/* A team is not finished until its last attempt is
                              scored, and the sum above says nothing about how
                              many are still to come. */}
                          {s.attempts.some((a) => !a.played) && (
                            <p className="mt-2 text-xs text-gray-500">
                              {s.attempts.filter((a) => !a.played).length} attempt
                              {s.attempts.filter((a) => !a.played).length === 1 ? '' : 's'} still to come
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : activeView === 'standings' ? (
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
          {activeView === 'finals'
            ? <MatchSection title="Finals" rows={visibleMatches} highlight roomy isHit={isHit} />
            : <MatchSection title="Qualification" rows={visibleMatches} isHit={isHit} />}
        </div>
      )}
    </div>
  );
}
