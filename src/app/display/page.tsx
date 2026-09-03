'use client';
import { useEffect, useState, useRef } from 'react';
import StandingsTable from '../StandingsTable';
import FullscreenButton from './FullscreenButton';

interface AllianceLineup { teams: string[] }
interface AllianceBreakdown { suppression: number; multiplier: number; partnerClimbPoints: number; penalty: number }
interface AllianceResult extends AllianceLineup, AllianceBreakdown { score: number }

type DisplayPayload =
  | { phase: 'standings' }
  | { phase: 'live'; matchNumber: number; matchPhase: 'qualification' | 'playoff'; red: AllianceLineup; blue: AllianceLineup }
  | {
      phase: 'result'; matchNumber: number; matchPhase: 'qualification' | 'playoff';
      red: AllianceResult; blue: AllianceResult;
      extinguisher: number; coopertition: number; winner: 'red' | 'blue' | 'tie';
    };

interface MatchSummary {
  id: number; number: number; phase: 'qualification' | 'playoff'; played: boolean;
  red: string[]; blue: string[]; redSeed: number | null; blueSeed: number | null;
}
interface AllianceStanding { seed: number; total: number; matchesPlayed: number; teams: string[] }

const POLL_MS = 3000;
const CANVAS_W = 1920;
const CANVAS_H = 1080;

const F_HEAD = 'var(--font-barlow-condensed), sans-serif';
const F_SANS = 'var(--font-ibm-plex-sans), sans-serif';
const F_MONO = 'var(--font-ibm-plex-mono), monospace';

// Fixed 1920x1080 design canvas, scaled to fit whatever screen it's on —
// copied from FGC Match/Playoffs Display.html, which render the same way.
// A field display always runs at a specific projector resolution; rendering
// at a fixed size and scaling keeps every pixel value below identical to
// the reference regardless of the actual screen.
function useCanvasScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => setScale(Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return scale;
}

function gridTexture(opacity: number): React.CSSProperties {
  return {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage:
      `linear-gradient(oklch(1 0 0 / ${opacity}) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / ${opacity}) 1px, transparent 1px)`,
    backgroundSize: '96px 96px',
  };
}

function matchLabel(phase: 'qualification' | 'playoff', number: number) {
  return `${phase === 'playoff' ? 'P' : 'Q'}${number}`;
}

function useClock() {
  // Starts null and is filled by the effect: rendering the clock on the server
  // and again on the client would mismatch, and reading it during render is
  // not pure.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const t0 = setTimeout(() => setNow(new Date()), 0);
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => { clearTimeout(t0); clearInterval(t); };
  }, []);
  return now;
}

export default function DisplayPage() {
  const [data, setData] = useState<DisplayPayload | null>(null);
  const [matches, setMatches] = useState<MatchSummary[] | null>(null);
  const [allianceStandings, setAllianceStandings] = useState<AllianceStanding[] | null>(null);
  const scale = useCanvasScale();
  const clock = useClock();

  // A projector nobody is watching closely is the worst place for a silent
  // failure: without this the screen keeps showing the last score it got,
  // with no hint that the server stopped answering minutes ago.
  const [stale, setStale] = useState(false);
  // Two independent pollers feed this screen. /api/standings is the heavy one
  // (it re-scores every match), so it is the more likely of the two to start
  // failing under load — the banner has to watch both, or half the screen
  // freezes silently while the other half looks healthy.
  const lastStandingsAt = useRef(0);
  // 0 until the first response — set inside the effect, since reading the
  // clock during render is not pure.
  const lastSuccessAt = useRef(0);

  useEffect(() => {
    lastSuccessAt.current = Date.now();
    lastStandingsAt.current = Date.now();
    let requestId = 0;
    let latest = 0;
    let controller: AbortController | null = null;
    const load = () => {
      const id = ++requestId;
      controller?.abort();
      controller = new AbortController();
      fetch('/api/display/state', { cache: 'no-store', signal: controller.signal })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((json) => {
          if (id > latest) { latest = id; setData(json); }
          lastSuccessAt.current = Date.now();
          setStale(false);
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, POLL_MS);
    // Three missed polls — the screen is refreshed every POLL_MS, so this
    // stays quiet through a single slow response.
    const staleTimer = setInterval(() => {
      const cutoff = POLL_MS * 3 + 2_000;
      const oldest = Math.min(lastSuccessAt.current, lastStandingsAt.current);
      setStale(Date.now() - oldest > cutoff);
    }, 2_000);
    return () => { clearInterval(timer); clearInterval(staleTimer); controller?.abort(); };
  }, []);

  // Only needed for the dark broadcast canvas (ticker + playoff table) — the
  // plain qualification standings branch below renders the public
  // StandingsTable, which already fetches its own data.
  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;
    const load = () => {
      controller?.abort();
      controller = new AbortController();
      fetch('/api/standings', { cache: 'no-store', signal: controller.signal })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((json) => {
          if (cancelled) return;
          setMatches(json.matches);
          setAllianceStandings(json.allianceStandings ?? null);
          lastStandingsAt.current = Date.now();
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(timer); controller?.abort(); };
  }, []);

  // The draft being finished is not the same thing as the playoff having
  // started: /api/standings fills allianceStandings the moment the last pick
  // is made. Keyed on that alone, the projector jumped to an empty PLAYOFFS
  // table right at the ceremony and could never be sent back to the
  // qualification rankings. The bracket existing is the real signal.
  const playoffBracketExists = !!matches?.some((m) => m.phase === 'playoff');
  const isPlayoffMode = !!(allianceStandings && allianceStandings.length === 3 && playoffBracketExists);

  // Plain qualification standings — not a broadcast moment, just the same
  // public board that's already at "/". No dark canvas, no scaling.
  if (data?.phase === 'standings' && !isPlayoffMode) {
    return (
      <div className="min-h-screen bg-gray-100 text-gray-900">
        <FullscreenButton />
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10 h-14 sm:h-16 flex items-center px-4 sm:px-8">
          <div>
            <h1 className="text-lg sm:text-xl font-bold leading-tight">FGC Uzbekistan 2026</h1>
            <p className="text-xs text-gray-500 leading-tight">Igniting Innovation · live results and rankings</p>
          </div>
        </header>
        {/* The same board the hall reads on their phones, but this one is
            seen from 15+ metres — scale it up for the projector. */}
        <main className="p-4 sm:p-8" style={{ zoom: 1.6 }}>
          <StandingsTable />
        </main>
      </div>
    );
  }

  const nextMatch = (() => {
    if (!matches) return null;
    if (data && data.phase !== 'standings') {
      const upcoming = matches
        .filter((m) => m.phase === data.matchPhase && m.number > data.matchNumber && !m.played)
        .sort((a, b) => a.number - b.number);
      if (upcoming.length) return upcoming[0];
    }
    // Excluding the match on screen: when the live match is the last unplayed
    // one of its phase, the fallback below used to hand back that same match
    // and the ticker announced it as "next".
    const onScreen = data && data.phase !== 'standings'
      ? { phase: data.matchPhase, number: data.matchNumber } : null;
    const remaining = matches
      .filter((m) => !m.played
        && !(onScreen && m.phase === onScreen.phase && m.number === onScreen.number))
      .sort((a, b) => (a.phase === b.phase ? a.number - b.number : a.phase === 'qualification' ? -1 : 1));
    // Once the bracket exists the event has moved on, so a qualification match
    // left unplayed (a cancelled one, say) must not be announced to the hall as
    // what is coming up next during the finals.
    const playoffFirst = remaining.filter((m) => m.phase === 'playoff');
    if (playoffBracketExists && playoffFirst.length) return playoffFirst[0];
    return remaining[0] ?? null;
  })();

  // matches === null means /api/standings has not answered yet (or is
  // failing) — that is not the same as "nothing left to play", which is what
  // the ticker's own fallback says.
  const nextMatchLabel = matches === null
    ? '—'
    : nextMatch
    ? `${matchLabel(nextMatch.phase, nextMatch.number)} · ${
      nextMatch.redSeed !== null && nextMatch.blueSeed !== null
        ? `Alliance ${nextMatch.redSeed} vs Alliance ${nextMatch.blueSeed}`
        : `${nextMatch.red.join(', ')} vs ${nextMatch.blue.join(', ')}`
    }`
    : null;

  // Everything else — live, result, or the playoff alliance table — is the
  // dark broadcast canvas copied from FGC Match/Playoffs Display.html.
  return (
    <div style={{
      width: '100vw', height: '100vh', background: 'rgb(11, 15, 22)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }}>
      <div style={{
        width: CANVAS_W, height: CANVAS_H, flex: '0 0 auto', position: 'relative', overflow: 'hidden',
        transform: `scale(${scale})`,
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
        padding: '40px 60px 34px', color: 'oklch(1 0 0)', fontFamily: F_SANS,
        background: isPlayoffMode
          ? 'linear-gradient(158deg, oklch(0.58 0.27 348) 0%, oklch(0.63 0.24 356) 26%, oklch(0.7 0.17 30) 52%, oklch(0.68 0.15 235) 78%, oklch(0.62 0.17 244) 100%)'
          : 'linear-gradient(160deg, oklch(0.3 0.03 245) 0%, oklch(0.2 0.025 250) 55%, oklch(0.15 0.02 255) 100%)',
      }}>
        <div style={gridTexture(isPlayoffMode ? 0.05 : 0.028)} />

        {!data && (
          <p style={{ color: 'oklch(1 0 0 / 0.4)', margin: 'auto' }}>
            {stale ? 'No connection to the scoring server' : 'Loading…'}
          </p>
        )}
        {stale && data && (
          <div style={{
            position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)',
            padding: '6px 18px', borderRadius: 999, zIndex: 20,
            background: 'oklch(0.55 0.22 25)', color: 'oklch(1 0 0)',
            fontSize: 20, fontWeight: 700, letterSpacing: '0.08em',
          }}>
            NO CONNECTION
          </div>
        )}

        {data?.phase === 'standings' && isPlayoffMode && (
          <PlayoffScreen standings={allianceStandings!} nextMatchLabel={nextMatchLabel} clock={clock} />
        )}
        {data && data.phase !== 'standings' && (
          <MatchScreen data={data} nextMatchLabel={nextMatchLabel} clock={clock} />
        )}
      </div>
      <FullscreenButton />
    </div>
  );
}

function Ticker({ label, clock }: { label: string | null; clock: Date | null }) {
  return (
    <div style={{
      position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 40, marginTop: 22, paddingTop: 18, borderTop: '1px solid oklch(1 0 0 / 0.14)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, minWidth: 0 }}>
        <div style={{ fontFamily: F_MONO, fontSize: 19, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'oklch(0.74 0.02 250)', whiteSpace: 'nowrap' }}>
          Next match
        </div>
        <div style={{ fontFamily: F_SANS, fontWeight: 600, fontSize: 26, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label ?? 'No matches remaining'}
        </div>
      </div>
      <div style={{ fontFamily: F_MONO, fontSize: 19, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'oklch(0.66 0.02 250)', flexShrink: 0 }}>
        {clock ? clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
      </div>
    </div>
  );
}

function Badge({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 12, padding: '12px 22px', borderRadius: 10,
      background: 'oklch(1 0 0 / 0.92)', color: 'oklch(0.24 0.02 250)',
    }}>
      <span style={{ fontFamily: F_MONO, fontSize: 20, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'oklch(0.45 0.02 250)' }}>
        {label}
      </span>
      <span style={{ fontFamily: F_MONO, fontSize: 32, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function MatchScreen({ data, nextMatchLabel, clock }: {
  data: Extract<DisplayPayload, { phase: 'live' | 'result' }>;
  nextMatchLabel: string | null; clock: Date | null;
}) {
  const isResult = data.phase === 'result';
  const result = isResult ? (data as Extract<DisplayPayload, { phase: 'result' }>) : null;

  return (
    <>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, marginBottom: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
          <div style={{ fontFamily: F_HEAD, fontWeight: 700, fontSize: 82, lineHeight: 0.9, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            {isResult ? 'Results' : 'On field'}
          </div>
          <Badge label="Match" value={matchLabel(data.matchPhase, data.matchNumber)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontFamily: F_HEAD, fontWeight: 700, fontSize: 34, lineHeight: 1, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              FGC Uzbekistan 2026
            </div>
            <div style={{ fontFamily: F_MONO, fontSize: 17, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'oklch(0.72 0.02 250)' }}>
              {data.matchPhase === 'playoff' ? 'Playoff' : 'Qualification'} · Tashkent
            </div>
          </div>
          {data.phase === 'live' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderRadius: 10,
              background: 'oklch(0.6 0.21 25 / 0.16)', border: '1px solid oklch(0.62 0.21 25 / 0.55)',
            }}>
              <span style={{
                width: 12, height: 12, borderRadius: '50%', background: 'oklch(0.66 0.22 25)',
                animation: 'fgcPulse 1.5s ease-in-out infinite',
              }} />
              <span style={{ fontFamily: F_MONO, fontSize: 19, fontWeight: 600, letterSpacing: '0.2em' }}>LIVE</span>
            </div>
          )}
        </div>
      </div>

      <style>{'@keyframes fgcPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }'}</style>

      <div style={{ position: 'relative', flex: '1 1 0%', minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
        <AlliancePanel color="red" data={data.red} isWinner={result?.winner === 'red'}
          shared={result ? { extinguisher: result.extinguisher, coopertition: result.coopertition } : null} />
        <AlliancePanel color="blue" data={data.blue} isWinner={result?.winner === 'blue'}
          shared={result ? { extinguisher: result.extinguisher, coopertition: result.coopertition } : null} />
      </div>

      <Ticker label={nextMatchLabel} clock={clock} />
    </>
  );
}

const ALLIANCE_THEME = {
  red: {
    gradient: 'linear-gradient(165deg, oklch(0.62 0.21 28) 0%, oklch(0.52 0.19 22) 100%)',
    shadow: '0 30px 70px oklch(0.2 0.05 20 / 0.45)',
    divider: 'oklch(0.62 0.19 25 / 0.28)',
    label: 'Red alliance',
  },
  blue: {
    gradient: 'linear-gradient(165deg, oklch(0.62 0.16 245) 0%, oklch(0.5 0.16 250) 100%)',
    shadow: '0 30px 70px oklch(0.2 0.05 250 / 0.5)',
    divider: 'oklch(0.55 0.16 250 / 0.28)',
    label: 'Blue alliance',
  },
} as const;

const BREAKDOWN_ROWS: { key: keyof AllianceBreakdown | 'extinguisher' | 'coopertition'; label: string; swatch: string; shared?: boolean }[] = [
  { key: 'suppression', label: 'Suppression', swatch: 'oklch(0.72 0.15 70)' },
  { key: 'multiplier', label: 'Climb multiplier', swatch: 'oklch(0.6 0.18 300)' },
  { key: 'partnerClimbPoints', label: 'Partner climbs', swatch: 'oklch(0.65 0.15 230)' },
  { key: 'extinguisher', label: 'Extinguisher', swatch: 'oklch(0.62 0.13 160)', shared: true },
  { key: 'coopertition', label: 'Coopertition bonus', swatch: 'oklch(0.62 0.13 160)', shared: true },
  // These are the points this alliance GAINED from the opponent's fouls —
  // labelled "Penalty" it read on the projector as a deduction against them.
  { key: 'penalty', label: 'Opponent fouls', swatch: 'oklch(0.6 0.2 25)' },
];

function AlliancePanel({ color, data, isWinner, shared }: {
  color: 'red' | 'blue';
  data: AllianceLineup | AllianceResult;
  isWinner: boolean;
  shared: { extinguisher: number; coopertition: number } | null;
}) {
  const breakdown = 'score' in data ? data : null;
  const theme = ALLIANCE_THEME[color];
  const winOutline = color === 'red' ? 'oklch(0.95 0.1 90 / 0.85)' : 'oklch(0.92 0.1 195 / 0.85)';

  return (
    <section style={{
      position: 'relative', display: 'flex', flexDirection: 'column', borderRadius: 20, overflow: 'hidden',
      background: theme.gradient, boxShadow: theme.shadow,
      ...(isWinner ? { outline: `${winOutline} solid 3px`, outlineOffset: -3 } : {}),
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, height: 62,
        padding: isWinner ? '0 0 0 30px' : '0 30px', background: 'oklch(0 0 0 / 0.14)',
      }}>
        <div style={{ fontFamily: F_MONO, fontSize: 21, fontWeight: 600, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'oklch(1 0 0 / 0.9)' }}>
          {theme.label}
        </div>
        {isWinner && (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 30px', background: 'oklch(0.95 0.02 195)', color: 'oklch(0.22 0.02 250)' }}>
            <div style={{ fontFamily: F_HEAD, fontWeight: 700, fontSize: 38, lineHeight: 1, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Win</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', padding: '16px 30px 6px' }}>
        {data.teams.map((name, i) => (
          <div key={i} style={{ padding: '16px 0', borderBottom: '1px solid oklch(1 0 0 / 0.28)' }}>
            <div style={{ fontFamily: F_SANS, fontWeight: 600, fontSize: 38, lineHeight: 1.1 }}>{name}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: '1 1 0%', minHeight: 0, display: 'flex', flexDirection: 'column', padding: '14px 30px 0' }}>
        {BREAKDOWN_ROWS.map((row) => {
          const value = row.shared
            ? (shared ? shared[row.key as 'extinguisher' | 'coopertition'] : null)
            : (breakdown ? breakdown[row.key as keyof AllianceBreakdown] : null);
          const display = value === null
            ? '—'
            : row.key === 'multiplier' ? `×${(value as number).toFixed(2)}`
              : row.key === 'coopertition' ? `+${value}`
                : value;
          return (
            <div key={row.key} style={{
              flex: '1 1 0%', minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 118px', alignItems: 'center',
              gap: 18, background: 'oklch(1 0 0 / 0.92)', color: 'oklch(0.22 0.02 250)',
              borderBottom: `1px solid ${theme.divider}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingLeft: 20 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: row.swatch }} />
                <div style={{ fontFamily: F_SANS, fontWeight: 500, fontSize: 26, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {row.label}
                </div>
              </div>
              <div style={{
                height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: F_MONO, fontSize: 32, fontWeight: 600, borderLeft: `1px solid ${theme.divider}`,
              }}>
                {display}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: '22px 30px 24px' }}>
        <div style={{ fontFamily: F_HEAD, fontWeight: 700, fontSize: 44, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'oklch(1 0 0 / 0.92)' }}>
          Total
        </div>
        <div style={{ fontFamily: F_HEAD, fontWeight: 700, fontSize: 96, lineHeight: 0.8 }}>
          {breakdown ? breakdown.score : '—'}
        </div>
      </div>
    </section>
  );
}

function PlayoffScreen({ standings, nextMatchLabel, clock }: {
  standings: AllianceStanding[]; nextMatchLabel: string | null; clock: Date | null;
}) {
  return (
    <>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 26 }}>
        <div style={{ fontFamily: F_MONO, fontSize: 22, fontWeight: 600, letterSpacing: '0.44em', textTransform: 'uppercase', color: 'oklch(1 0 0 / 0.95)' }}>
          Uzbekistan
        </div>
        <div style={{
          fontFamily: F_HEAD, fontWeight: 700, fontSize: 74, lineHeight: 0.9, letterSpacing: '0.04em', textTransform: 'uppercase',
          marginTop: 6, textShadow: 'oklch(0.25 0.08 340 / 0.5) 0px 4px 24px',
        }}>
          Playoffs
        </div>

        <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontFamily: F_HEAD, fontWeight: 700, fontSize: 30, lineHeight: 1, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              FGC Uzbekistan 2026
            </div>
            <div style={{ fontFamily: F_MONO, fontSize: 16, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'oklch(1 0 0 / 0.88)' }}>
              Tashkent
            </div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderRadius: 10,
            background: 'oklch(1 0 0 / 0.14)', border: '1px solid oklch(1 0 0 / 0.5)',
          }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'oklch(1 0 0)', animation: 'fgcPulse 1.5s ease-in-out infinite' }} />
            <span style={{ fontFamily: F_MONO, fontSize: 18, fontWeight: 600, letterSpacing: '0.2em' }}>LIVE</span>
          </div>
        </div>
      </div>

      <style>{'@keyframes fgcPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }'}</style>

      <div style={{
        flex: '1 1 0%', minHeight: 0, display: 'flex', flexDirection: 'column', borderRadius: 18, overflow: 'hidden',
        boxShadow: '0 30px 70px oklch(0.14 0.03 250 / 0.55)',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '150px repeat(3, 1fr) 210px', alignItems: 'stretch',
          background: 'oklch(0.2 0.04 320)', borderBottom: '2px solid oklch(1 0 0 / 0.6)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px 0', fontFamily: F_MONO, fontSize: 21, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'oklch(1 0 0 / 0.9)' }}>
            Rank
          </div>
          <div style={{ gridColumn: 'span 3', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 0 4px', textAlign: 'center', fontFamily: F_MONO, fontSize: 19, letterSpacing: '0.26em', textTransform: 'uppercase', color: 'oklch(0.9 0.1 350)' }}>
              Alliance
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {['Team 1', 'Team 2', 'Team 3'].map((t) => (
                <div key={t} style={{ padding: '2px 0 12px', textAlign: 'center', fontFamily: F_MONO, fontSize: 20, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'oklch(1 0 0 / 0.82)' }}>
                  {t}
                </div>
              ))}
            </div>
          </div>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '14px 0',
            borderLeft: '1px solid oklch(1 0 0 / 0.14)', fontFamily: F_MONO, fontSize: 21, fontWeight: 600, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: 'oklch(1 0 0 / 0.9)',
          }}>
            <div>Total</div>
            <div>Score</div>
          </div>
        </div>

        <div style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column' }}>
          {standings.map((a, i) => (
            <div key={a.seed} style={{
              flex: '1 1 0%', minHeight: 0, display: 'grid', gridTemplateColumns: '150px repeat(3, 1fr) 210px',
              alignItems: 'stretch', background: i % 2 ? 'oklch(0.96 0.004 250)' : 'oklch(0.99 0.002 250)',
              borderBottom: '1px solid oklch(0.55 0.02 250 / 0.18)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'oklch(0.78 0.18 350 / 0.28)',
                color: 'oklch(0.2 0.02 250)', fontFamily: F_HEAD, fontWeight: 700, fontSize: 52, lineHeight: 1,
                flexDirection: 'column', gap: 2,
              }}>
                {i + 1}
                {/* The ticker announces "Alliance 2 vs Alliance 3" — without
                    the seed here the hall cannot find those in the table. */}
                <span style={{ fontFamily: F_MONO, fontSize: 17, fontWeight: 600, letterSpacing: '0.1em', opacity: 0.75 }}>
                  A{a.seed}
                </span>
              </div>
              {a.teams.map((name, ti) => (
                <div key={ti} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 14px', textAlign: 'center',
                  borderLeft: '1px solid oklch(0.55 0.02 250 / 0.14)', fontFamily: F_SANS, fontWeight: 500, fontSize: 30,
                  lineHeight: 1.08, color: 'oklch(0.22 0.02 250)',
                }}>
                  {name}
                </div>
              ))}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid oklch(0.55 0.02 250 / 0.2)',
                background: 'oklch(0.94 0.005 250)', fontFamily: F_MONO, fontSize: 44, fontWeight: 600, color: 'oklch(0.2 0.02 250)',
              }}>
                {a.total}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, marginTop: 22, paddingTop: 18, borderTop: '1px solid oklch(1 0 0 / 0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, minWidth: 0 }}>
          <div style={{ fontFamily: F_MONO, fontSize: 19, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'oklch(1 0 0 / 0.88)', whiteSpace: 'nowrap' }}>
            Next up
          </div>
          <div style={{ fontFamily: F_SANS, fontWeight: 600, fontSize: 26, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nextMatchLabel ?? 'No matches remaining'}
          </div>
        </div>
        <div style={{ fontFamily: F_MONO, fontSize: 19, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'oklch(1 0 0 / 0.92)', flexShrink: 0 }}>
          {clock ? clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </div>
      </div>
    </>
  );
}
