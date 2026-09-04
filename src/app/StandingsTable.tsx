'use client';
import React, { useEffect, useRef, useState } from 'react';

interface Standing {
  teamId: number; name: string; rankingScore: number;
  played: number; best: number; suppressionTotal: number;
}
interface SkillsAttempt { round: number; score: number | null; played: boolean }
interface SkillsRow {
  teamId: number; name: string; total: number; best: number; attemptsPlayed: number;
  attempts: SkillsAttempt[];
}
interface AllianceStanding { seed: number; total: number; matchesPlayed: number; teams: string[] }
interface Match {
  id: number; number: number; phase: string; played: boolean;
  red: string[]; blue: string[]; redScore: number | null; blueScore: number | null;
}

/**
 * How the board names a match in its own list: spelled out, the way FIRST
 * Global's results page writes "Round Robin Match 4".
 *
 * The short form stays where it is announced and where space is tight — the
 * projector, the referee's list — so `matchLabel` is left alone.
 */
function longMatchLabel(phase: string, number: number): string {
  return phase === 'playoff' ? `Finals Match ${number}` : `Qualification Match ${number}`;
}

/**
 * A team's name, clickable wherever it appears — their page opens a card for
 * the team from any of these, and a spectator looking at a match row is
 * exactly the person who wants to know how that team has been doing.
 */
function TeamName({ name, onTeam, className = '' }: {
  name: string; onTeam?: (name: string) => void; className?: string;
}) {
  if (!onTeam) return <span className={className}>{name}</span>;
  return (
    <button onClick={() => onTeam(name)} className={`${className} hover:underline cursor-pointer`}>
      {name}
    </button>
  );
}

function MatchSection({ title, rows, highlight = false, roomy = false, isHit, onTeam, mine }: {
  title: string;
  rows: Match[];
  highlight?: boolean;
  /** Three finals in a table built for twelve qualification rows leaves half
   *  the screen blank; the shorter list can afford bigger type and more air. */
  roomy?: boolean;
  isHit: (m: Match) => boolean;
  /** Opens a team's own card. Absent inside that card — it is already open. */
  onTeam?: (name: string) => void;
  /** Inside a team's card, that team's cell is filled solid, as on their page. */
  mine?: string;
}) {
  return (
    <div>
      {/* A centred pill, the way their page heads "Round Robin Matches" — not
          a left-aligned bar of small capitals. */}
      <div className="flex justify-center py-4 bg-gray-50/60 border-y border-gray-100">
        <span className={`rounded-full border px-5 py-1.5 text-sm font-medium ${
          highlight ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-700'
        }`}>
          {title}
        </span>
      </div>
      {/* On a phone the four-column table could only fit by scrolling
          sideways, which reads as a broken page: the blue alliance sits off
          the edge and nobody thinks to drag it into view. Below `sm` each
          match becomes a stacked card instead — the same rows, no scrolling. */}
      <div className="sm:hidden divide-y divide-gray-100">
        {rows.map((m) => {
          const phaseLabel = longMatchLabel(m.phase, m.number);
          const redWins = m.played && m.redScore !== null && m.blueScore !== null && m.redScore > m.blueScore;
          const blueWins = m.played && m.redScore !== null && m.blueScore !== null && m.blueScore > m.redScore;
          const hit = isHit(m);
          return (
            <div key={m.id} className={`px-3 py-2.5 ${hit ? 'bg-yellow-100 ring-2 ring-yellow-300 ring-inset' : ''}`}>
              <div className={`font-medium ${!m.played ? 'text-gray-500' : redWins ? 'text-red-600' : blueWins ? 'text-blue-600' : 'text-emerald-600'} ${roomy ? 'text-lg' : 'text-sm'}`}>
                {phaseLabel}
              </div>
              <div className="mt-1.5 flex items-baseline gap-2 rounded bg-red-50 px-2 py-1">
                <span className={`grow text-sm ${redWins ? 'font-black' : 'font-medium'}`}>
                  {m.red.map((name, i) => (
                    <span key={name}>
                      {i > 0 && <span className="text-red-300"> · </span>}
                      <TeamName name={name} onTeam={onTeam}
                        className={name === mine ? 'text-red-900 font-black underline' : 'text-red-700'} />
                    </span>
                  ))}
                </span>
                {m.played
                  ? <span className={`shrink-0 font-mono text-red-900 ${redWins ? 'font-black' : 'font-medium'}`}>{m.redScore}</span>
                  : <span className="shrink-0 text-red-300">—</span>}
              </div>
              <div className="mt-1 flex items-baseline gap-2 rounded bg-blue-50 px-2 py-1">
                <span className={`grow text-sm ${blueWins ? 'font-black' : 'font-medium'}`}>
                  {m.blue.map((name, i) => (
                    <span key={name}>
                      {i > 0 && <span className="text-blue-300"> · </span>}
                      <TeamName name={name} onTeam={onTeam}
                        className={name === mine ? 'text-blue-900 font-black underline' : 'text-blue-700'} />
                    </span>
                  ))}
                </span>
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
              const phaseLabel = longMatchLabel(m.phase, m.number);
              const redWins = m.played && m.redScore !== null && m.blueScore !== null && m.redScore > m.blueScore;
              const blueWins = m.played && m.redScore !== null && m.blueScore !== null && m.blueScore > m.redScore;
              const hit = isHit(m);
              const labelColour = !m.played ? 'text-gray-500'
                : redWins ? 'text-red-600' : blueWins ? 'text-blue-600' : 'text-emerald-600';
              return (
                <tr key={m.id} className={`${roomy ? '[&>td]:py-7 sm:[&>td]:py-12' : ''} ${hit ? 'bg-yellow-100 ring-2 ring-yellow-300 ring-inset' : ''}`}>
                  <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap w-44 sm:w-56">
                    {/* No "tie" caption: on their page a drawn match says so
                        by turning the label green, and nothing else. */}
                    <span className={`font-medium ${labelColour} ${roomy ? 'text-lg sm:text-2xl' : 'text-sm'}`}>
                      {phaseLabel}
                    </span>
                  </td>
                  {/* One cell per team rather than a "a · b · c" string: the
                      three names line up down the list the way theirs do, so a
                      team can be found by running the eye down one column. */}
                  {m.red.map((name, i) => (
                    <td key={`r${i}`} className={`px-2 sm:px-3 py-2 sm:py-3 ${
                      name === mine ? 'bg-red-500' : hit ? '' : 'bg-red-50'}`}>
                      <TeamName name={name} onTeam={onTeam}
                        className={`${name === mine ? 'text-white' : 'text-red-700'} ${roomy ? 'text-base sm:text-xl' : 'text-sm'} ${redWins ? 'font-bold' : 'font-normal'}`} />
                    </td>
                  ))}
                  {m.blue.map((name, i) => (
                    <td key={`b${i}`} className={`px-2 sm:px-3 py-2 sm:py-3 ${
                      name === mine ? 'bg-blue-600' : hit ? '' : 'bg-blue-50'}`}>
                      <TeamName name={name} onTeam={onTeam}
                        className={`${name === mine ? 'text-white' : 'text-blue-700'} ${roomy ? 'text-base sm:text-xl' : 'text-sm'} ${blueWins ? 'font-bold' : 'font-normal'}`} />
                    </td>
                  ))}
                  <td className={`px-2 sm:px-4 py-2 sm:py-3 text-right w-16 sm:w-24 ${hit ? '' : 'bg-red-100'}`}>
                    {m.played
                      ? <span className={`text-gray-900 ${redWins ? 'font-bold' : 'font-normal'} ${roomy ? 'text-xl sm:text-3xl' : 'text-sm'}`}>{m.redScore}</span>
                      : <span className="text-red-300">—</span>}
                  </td>
                  <td className={`px-2 sm:px-4 py-2 sm:py-3 text-right w-16 sm:w-24 ${hit ? '' : 'bg-blue-100'}`}>
                    {m.played
                      ? <span className={`text-gray-900 ${blueWins ? 'font-bold' : 'font-normal'} ${roomy ? 'text-xl sm:text-3xl' : 'text-sm'}`}>{m.blueScore}</span>
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

/**
 * A team's own card, opened by clicking its name anywhere on the board —
 * copied from the card FIRST Global's results page opens for a team: who they
 * are and where they stand at the top, then every match they are in, with
 * their own cell filled solid so it can be picked out of the row at a glance.
 */
function TeamCard({ name, rank, standing, matches, onClose }: {
  name: string;
  rank: number | null;
  standing: Standing | undefined;
  matches: Match[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    // The page behind must not scroll while the card is over it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const playoff = matches.filter((m) => m.phase === 'playoff');
  const qual = matches.filter((m) => m.phase !== 'playoff');
  const never = () => false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-8"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Team ${name}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-2xl bg-white shadow-xl my-4"
      >
        <div className="flex items-start justify-between gap-4 px-5 sm:px-7 pt-5 sm:pt-6">
          <h2 className="text-xl sm:text-3xl font-bold text-gray-900">Team {name}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-5 sm:px-7 pt-4">
          {rank !== null && (
            <span className="inline-block rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">
              Rank #{rank}
            </span>
          )}
          <dl className="mt-4 rounded-xl border border-gray-200 divide-y divide-gray-200 text-sm sm:text-base">
            {[
              ['Ranking Score', standing && standing.played > 0 ? standing.rankingScore.toFixed(2) : '—'],
              ['Highest Score', standing ? standing.best : '—'],
              ['Total Suppression Points', standing ? standing.suppressionTotal : '—'],
              ['Matches Played', standing ? standing.played : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-gray-600">{label}:</dt>
                <dd className="font-bold text-gray-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-5 overflow-hidden rounded-b-2xl">
          {playoff.length > 0 && (
            <MatchSection title="Finals Matches" rows={playoff} highlight isHit={never} mine={name} />
          )}
          {qual.length > 0
            ? <MatchSection title="Qualification Matches" rows={qual} isHit={never} mine={name} />
            : playoff.length === 0 && (
              <p className="px-5 sm:px-7 py-8 text-center text-gray-500">
                This team has no matches yet.
              </p>
            )}
        </div>
      </div>
    </div>
  );
}

export default function StandingsTable() {
  const [data, setData] = useState<{
    standings: Standing[]; matches: Match[]; skills?: SkillsRow[];
    allianceStandings?: AllianceStanding[] | null;
  } | null>(null);
  const [view, setView] = useState<'standings' | 'matches' | 'finals' | 'skills'>('standings');
  // Which team's attempts are open on the skills tab. One at a time: the point
  // of the tab is to look at a team, and three teams unfolded at once is the
  // long list the tab exists to avoid.
  const [openTeam, setOpenTeam] = useState<number | null>(null);
  // Whose card is open over the board, by name — the name is what every table
  // on this page carries, and what a click hands back.
  const [cardTeam, setCardTeam] = useState<string | null>(null);
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
  // Their Finals tab is the alliance table, not a list of matches — the three
  // finals matches live in Matches Results with the rest, under their own
  // heading. So the tab follows the alliances, not the bracket.
  const alliances = data.allianceStandings ?? [];
  const activeView = (view === 'finals' && alliances.length === 0)
    || (view === 'skills' && skills.length === 0)
      ? 'matches' : view;
  // Counted over what this tab actually shows: "Found 3" while looking at a
  // list of one is worse than no count at all.
  const totalHits = q ? data.matches.filter(isHit).length : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-3 sm:px-4">
        {/* Four tabs do not fit across a phone: they used to wrap onto two
            lines and drop "Finals" off the edge. They stay on one line and
            scroll instead, which is what a tab strip is supposed to do. */}
        <div className="flex gap-1 overflow-x-auto whitespace-nowrap">
          <button
            onClick={() => setView('standings')}
            className={`shrink-0 px-3 sm:px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeView === 'standings' ? 'text-blue-600 border-blue-600' : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            {/* "Rankings" is what FIRST Global's own results page calls this
                tab, and the short form is what lets four tabs fit a phone. */}
            Rankings
          </button>
          <button
            onClick={() => setView('matches')}
            className={`shrink-0 px-3 sm:px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeView === 'matches' ? 'text-blue-600 border-blue-600' : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            Matches Results
          </button>
          {/* The finals get their own tab, and only once they exist — an empty
              tab through the whole qualification day is just a dead end. */}
          {skills.length > 0 && (
            <button
              onClick={() => setView('skills')}
              className={`shrink-0 px-3 sm:px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeView === 'skills' ? 'text-blue-600 border-blue-600' : 'text-gray-600 border-transparent hover:text-gray-900'
              }`}
            >
              Skills
            </button>
          )}
          {alliances.length > 0 && (
            <button
              onClick={() => setView('finals')}
              className={`shrink-0 px-3 sm:px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeView === 'finals' ? 'text-blue-600 border-blue-600' : 'text-gray-600 border-transparent hover:text-gray-900'
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
                <th className="px-2 sm:px-6 py-3 text-left text-sm font-normal text-gray-600 border-b border-gray-200 w-8">#</th>
                <th className="px-2 sm:px-6 py-3 text-left text-sm font-normal text-gray-600 border-b border-gray-200">Team</th>
                <th className="px-2 sm:px-6 py-3 text-right text-sm font-normal text-gray-600 border-b border-gray-200">Skills total</th>
                <th className="hidden sm:table-cell px-3 sm:px-6 py-3 text-right text-sm font-normal text-gray-600 border-b border-gray-200">Best attempt</th>
                <th className="hidden sm:table-cell px-3 sm:px-6 py-3 text-right text-sm font-normal text-gray-600 border-b border-gray-200">Attempts</th>
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
                <th className="px-2 sm:px-6 py-3 text-left text-sm font-normal text-gray-600 border-b border-gray-200 w-10">Rank</th>
                <th className="px-2 sm:px-6 py-3 text-left text-sm font-normal text-gray-600 border-b border-gray-200">Team</th>
                <th className="px-2 sm:px-6 py-3 text-left text-sm font-normal text-gray-600 border-b border-gray-200 whitespace-nowrap">Ranking Score</th>
                {/* "Highest Points" is what their table calls a team's best
                    match; "Suppression" is ours, since we have no climb-points
                    column to fill theirs with. */}
                <th className="hidden sm:table-cell px-3 sm:px-6 py-3 text-left text-sm font-normal text-gray-600 border-b border-gray-200 whitespace-nowrap">Highest Points</th>
                <th className="hidden sm:table-cell px-3 sm:px-6 py-3 text-left text-sm font-normal text-gray-600 border-b border-gray-200 whitespace-nowrap">Suppression</th>
                <th className="hidden sm:table-cell px-3 sm:px-6 py-3 text-left text-sm font-normal text-gray-600 border-b border-gray-200 whitespace-nowrap">Played</th>
              </tr>
            </thead>
            <tbody className="text-base md:text-lg">
              {data.standings.map((s, i) => (
                <tr key={s.teamId} className="hover:bg-gray-50 border-b border-gray-100 last:border-0">
                  <td className="px-2 sm:px-6 py-2 sm:py-3 text-gray-400 w-8">{i + 1}</td>
                  <td className="px-2 sm:px-6 py-2 sm:py-3 text-sm md:text-base lg:text-lg">
                    <TeamName name={s.name} onTeam={setCardTeam} className="text-blue-600 font-medium" />
                  </td>
                  <td className="px-2 sm:px-6 py-2 sm:py-3">
                    {s.played === 0
                      ? <span className="text-gray-400 italic font-mono text-sm md:text-base lg:text-lg">—</span>
                      : <strong className="font-mono text-sm md:text-base lg:text-lg">{s.rankingScore.toFixed(1)}</strong>}
                  </td>
                  <td className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 font-mono text-sm md:text-base lg:text-lg text-gray-500">{s.best}</td>
                  <td className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 font-mono text-sm md:text-base lg:text-lg text-gray-500">{s.suppressionTotal}</td>
                  <td className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 font-mono text-sm md:text-base lg:text-lg text-gray-500">{s.played}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : activeView === 'finals' ? (
        /* Their Finals tab is the alliance table — rank, alliance, its score,
           how many it has played, and the teams in it. The finals matches
           themselves are in Matches Results with everything else. */
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse">
            <thead>
              <tr>
                <th className="px-2 sm:px-6 py-3 text-left text-sm font-normal text-gray-600 border-b border-gray-200 w-10">Rank</th>
                <th className="px-2 sm:px-6 py-3 text-left text-sm font-normal text-gray-600 border-b border-gray-200">Alliance</th>
                <th className="px-2 sm:px-6 py-3 text-left text-sm font-normal text-gray-600 border-b border-gray-200 whitespace-nowrap">Rank Score</th>
                <th className="hidden sm:table-cell px-3 sm:px-6 py-3 text-left text-sm font-normal text-gray-600 border-b border-gray-200">Played</th>
                <th className="px-2 sm:px-6 py-3 text-left text-sm font-normal text-gray-600 border-b border-gray-200">Team 1</th>
                <th className="hidden sm:table-cell px-3 sm:px-6 py-3 text-left text-sm font-normal text-gray-600 border-b border-gray-200">Team 2</th>
                <th className="hidden sm:table-cell px-3 sm:px-6 py-3 text-left text-sm font-normal text-gray-600 border-b border-gray-200">Team 3</th>
              </tr>
            </thead>
            <tbody className="text-base md:text-lg">
              {alliances.map((a, i) => (
                <tr key={a.seed} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-2 sm:px-6 py-2 sm:py-3 text-gray-400">{i + 1}</td>
                  <td className="px-2 sm:px-6 py-2 sm:py-3 font-medium">Alliance {a.seed}</td>
                  <td className="px-2 sm:px-6 py-2 sm:py-3"><strong className="font-mono">{a.total}</strong></td>
                  <td className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 font-mono text-gray-500">{a.matchesPlayed}</td>
                  {[0, 1, 2].map((n) => (
                    <td key={n} className={`px-2 sm:px-6 py-2 sm:py-3 ${n === 0 ? '' : 'hidden sm:table-cell'}`}>
                      {a.teams[n]
                        ? <TeamName name={a.teams[n]} onTeam={setCardTeam} className="text-blue-600" />
                        : <span className="text-gray-400">—</span>}
                    </td>
                  ))}
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
            <MatchSection title="Finals Matches" rows={playoffMatches} highlight roomy isHit={isHit} onTeam={setCardTeam} />
          )}
          <MatchSection title="Qualification Matches" rows={qualMatches} isHit={isHit} onTeam={setCardTeam} />
        </div>
      )}

      {cardTeam && (
        <TeamCard
          name={cardTeam}
          rank={(() => {
            const i = data.standings.findIndex((t) => t.name === cardTeam);
            return i === -1 ? null : i + 1;
          })()}
          standing={data.standings.find((t) => t.name === cardTeam)}
          matches={data.matches.filter((m) => m.red.includes(cardTeam) || m.blue.includes(cardTeam))}
          onClose={() => setCardTeam(null)}
        />
      )}
    </div>
  );
}
