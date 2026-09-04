'use client';
import { useEffect, useState, useRef, useSyncExternalStore } from 'react';
import StandingsTable from '../StandingsTable';
import { pickNextMatch } from '@/lib/next-match';
import FullscreenButton from './FullscreenButton';
import { EVENT_BACKGROUND, gridTexture } from '@/lib/brand';
import { matchClock, type ClockPeriod } from '@/lib/match-clock';
import { matchLabel } from '@/lib/match-label';

interface AllianceLineup { teams: string[] }
interface AllianceBreakdown { suppression: number; multiplier: number; partnerClimbPoints: number; penalty: number }
interface AllianceResult extends AllianceLineup, AllianceBreakdown { score: number }

type DisplayPayload =
  | { phase: 'standings' }
  | {
      phase: 'live'; matchNumber: number; matchPhase: 'qualification' | 'playoff';
      red: AllianceLineup; blue: AllianceLineup;
      startedAt: number | null; serverNow: number;
    }
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

// The state endpoint is one small row, and it now carries the moment a match
// starts: at three seconds a screen could learn about the start only as the
// 3-2-1 ended and show the hall nothing. The heavy standings poll keeps its
// own slower interval below.
const POLL_MS = 1000;
const STANDINGS_POLL_MS = 3000;
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

/**
 * White text on the event gradient loses contrast wherever the gradient goes
 * pale — the event name top right and the ticker bottom left were washing
 * out on the projector. Everything set over the gradient sits on this plate.
 */
const OVER_GRADIENT: React.CSSProperties = {
  background: 'oklch(0.18 0.03 300 / 0.42)',
  borderRadius: 12,
  padding: '10px 18px',
};

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

/**
 * The 2:30 countdown, ticking against the SERVER's clock.
 *
 * The projector laptop's own clock can sit minutes away from the scoring
 * server's, so the payload carries both the start and the server's "now": the
 * difference between that and the local clock is the offset applied on every
 * tick. Ticking four times a second, not once — a countdown that skips from
 * 0:02 to 0:00 in the hall's eyeline looks broken.
 */
function useMatchClock(startedAt: number | null | undefined, serverNow: number | undefined) {
  const [now, setNow] = useState<number | null>(null);
  const offset = useRef(0);

  useEffect(() => {
    if (serverNow !== undefined) offset.current = serverNow - Date.now();
  }, [serverNow]);

  useEffect(() => {
    const tick = () => setNow(Date.now() + offset.current);
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, []);

  if (startedAt === undefined || now === null) return null;
  return matchClock(startedAt ?? null, now);
}

const SOUNDS = {
  start: '/sounds/start.wav',
  endgame: '/sounds/endgame.wav',
  end: '/sounds/end.wav',
} as const;

/**
 * A browser refuses to play audio until someone has interacted with the page,
 * and a projector page nobody ever clicks is exactly that case — so the screen
 * asks for one click and unlocks all three clips at once by playing them
 * silently. Without it the hall would get a countdown and no whistle, with
 * nothing on screen explaining why.
 */
function useMatchSounds(period: ClockPeriod | null, matchKey: string | null) {
  const [unlocked, setUnlocked] = useState(false);
  const players = useRef<Record<string, HTMLAudioElement>>({});
  const previous = useRef<{ key: string | null; period: ClockPeriod | null }>({ key: null, period: null });

  useEffect(() => {
    for (const [name, src] of Object.entries(SOUNDS)) {
      const el = new Audio(src);
      el.preload = 'auto';
      players.current[name] = el;
    }
  }, []);

  const unlock = () => {
    for (const el of Object.values(players.current)) {
      const wasMuted = el.muted;
      el.muted = true;
      el.play().then(() => { el.pause(); el.currentTime = 0; el.muted = wasMuted; }).catch(() => {});
    }
    setUnlocked(true);
  };

  useEffect(() => {
    const play = (name: keyof typeof SOUNDS) => {
      const el = players.current[name];
      if (!el) return;
      el.currentTime = 0;
      el.play().catch(() => {});
    };

    const prev = previous.current;
    previous.current = { key: matchKey, period };

    if (!unlocked || period === null) return;

    // A screen opened in the middle of a match must not blast the start
    // whistle at the hall: only a transition seen on THIS screen fires a clip.
    if (matchKey !== prev.key) return;
    if (prev.period === period) return;

    // The start whistle belongs at the end of 3-2-1, not when the referee
    // pressed the button — that is the moment the field actually goes live.
    if ((prev.period === 'countdown' || prev.period === 'pre') && period === 'running') play('start');
    else if (prev.period === 'running' && period === 'endgame') play('endgame');
    else if ((prev.period === 'running' || prev.period === 'endgame') && period === 'over') play('end');
  }, [period, matchKey, unlocked]);

  return { unlocked, unlock };
}

export default function DisplayPage() {
  const [data, setData] = useState<DisplayPayload | null>(null);
  const [matches, setMatches] = useState<MatchSummary[] | null>(null);
  const [teamCount, setTeamCount] = useState(0);
  const [allianceStandings, setAllianceStandings] = useState<AllianceStanding[] | null>(null);
  const scale = useCanvasScale();
  const clock = useClock();

  // Three clock layouts, so the choice can be made on the actual projector in
  // the actual room: the default sits in the header beside the event name,
  // "?clock=big" takes the title's space on the left, and "?clock=center" puts
  // the digits down the middle of the field, between the two alliances.
  // useSyncExternalStore, not an effect: the server render has no query string,
  // and this is a read of the browser's own state that never changes afterwards.
  const clockVariant = useSyncExternalStore(
    () => () => {},
    () => {
      const v = new URLSearchParams(window.location.search).get('clock');
      return v === 'big' || v === 'center' ? v : 'header';
    },
    () => 'header' as const,
  );

  const live = data?.phase === 'live' ? data : null;
  const matchClockState = useMatchClock(
    live ? live.startedAt : undefined, live ? live.serverNow : undefined);
  const sounds = useMatchSounds(
    matchClockState?.period ?? null,
    live ? `${live.matchPhase}-${live.matchNumber}` : null);

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
    // Three missed polls of the slower of the two feeds, so a single slow
    // response never puts NO CONNECTION in front of the hall.
    const staleTimer = setInterval(() => {
      const cutoff = STANDINGS_POLL_MS * 3 + 2_000;
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
          setTeamCount(json.standings?.length ?? 0);
          setAllianceStandings(json.allianceStandings ?? null);
          lastStandingsAt.current = Date.now();
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, STANDINGS_POLL_MS);
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
      // Same broadcast gradient as the playoff screen: the qualification
      // rankings are on the projector between every match, and flat grey next
      // to the other two screens looked like a page that had failed to load.
      <div style={{ minHeight: '100vh', background: EVENT_BACKGROUND, position: 'relative' }}>
        <div style={{ ...gridTexture(0.05), position: 'fixed' }} />
        <FullscreenButton />
        <header style={{ position: 'relative', padding: '26px 48px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: F_MONO, fontSize: 20, fontWeight: 600, letterSpacing: '0.44em', textTransform: 'uppercase', color: 'oklch(1 0 0 / 0.95)' }}>
              Uzbekistan
            </div>
            <div style={{
              fontFamily: F_HEAD, fontWeight: 700, fontSize: 62, lineHeight: 0.9, letterSpacing: '0.04em',
              textTransform: 'uppercase', color: 'oklch(1 0 0)', textShadow: 'oklch(0.25 0.08 340 / 0.5) 0px 4px 24px',
            }}>
              Qualification
            </div>
          </div>
          <div style={{ ...OVER_GRADIENT, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 3, color: 'oklch(1 0 0)' }}>
            <div style={{ fontFamily: F_HEAD, fontWeight: 700, fontSize: 30, lineHeight: 1, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              FGC Uzbekistan 2026
            </div>
            <div style={{ fontFamily: F_MONO, fontSize: 16, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'oklch(1 0 0 / 0.88)' }}>
              Igniting Innovation · Tashkent
            </div>
          </div>
        </header>
        {/* The same board the hall reads on their phones, but this one is
            seen from 15+ metres — scale it up for the projector. */}
        {/* Zoomed to fill a projector, but the hall can only read what fits on
            the screen — nobody is going to scroll it. Roughly 190px of chrome
            plus ~85px per row at zoom 1, fitted into 1080px. */}
        <main style={{
          position: 'relative', padding: '20px 30px 30px',
          zoom: Math.min(1.6, Math.max(0.55, 880 / (110 + 53 * Math.max(teamCount, 1)))),
        }}>
          <StandingsTable />
        </main>
      </div>
    );
  }

  const nextMatch = matches
    ? pickNextMatch(
        matches,
        data && data.phase !== 'standings'
          ? { phase: data.matchPhase, number: data.matchNumber } : null,
        playoffBracketExists)
    : null;

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
        // One gradient for every broadcast screen — the match screen used to
        // be dark navy, which made it look like a different event.
        background: EVENT_BACKGROUND,
      }}>
        <div style={gridTexture(0.05)} />

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
          <MatchScreen data={data} nextMatchLabel={nextMatchLabel} clock={clock}
            matchClock={data.phase === 'live' ? matchClockState : null} clockVariant={clockVariant} />
        )}
        {live && !sounds.unlocked && (
          <button onClick={sounds.unlock} style={{
            // Sits in the empty middle of the ticker: the alliance panels above
            // carry the scores, and this disappears on the first tap anyway.
            position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 30,
            padding: '10px 26px', borderRadius: 999, cursor: 'pointer',
            background: 'oklch(0.78 0.16 85)', color: 'oklch(0.25 0.05 60)', border: 'none',
            fontFamily: F_MONO, fontSize: 18, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', boxShadow: '0 10px 40px oklch(0.2 0.05 60 / 0.5)',
          }}>
            Tap once to turn the whistle on
          </button>
        )}
      </div>
      <FullscreenButton />
    </div>
  );
}

function Ticker({ label, clock }: { label: string | null; clock: Date | null }) {
  return (
    <div style={{
      ...OVER_GRADIENT,
      position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 40, marginTop: 20, padding: '12px 22px',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, minWidth: 0 }}>
        <div style={{ fontFamily: F_MONO, fontSize: 19, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'oklch(1 0 0 / 0.85)', whiteSpace: 'nowrap' }}>
          Next match
        </div>
        <div style={{ fontFamily: F_SANS, fontWeight: 600, fontSize: 26, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label ?? 'No matches remaining'}
        </div>
      </div>
      <div style={{ fontFamily: F_MONO, fontSize: 19, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'oklch(1 0 0 / 0.85)', flexShrink: 0 }}>
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

function MatchScreen({ data, nextMatchLabel, clock, matchClock, clockVariant }: {
  data: Extract<DisplayPayload, { phase: 'live' | 'result' }>;
  nextMatchLabel: string | null; clock: Date | null;
  matchClock: ReturnType<typeof useMatchClock>;
  clockVariant: 'header' | 'big' | 'center';
}) {
  const isResult = data.phase === 'result';
  const result = isResult ? (data as Extract<DisplayPayload, { phase: 'result' }>) : null;
  // Every alternative layout only applies while a match is live — a result
  // screen keeps "RESULTS" and its two full-width alliance panels.
  const isLive = data.phase === 'live';
  const showBigClock = clockVariant === 'big' && isLive;
  const showCenterClock = clockVariant === 'center' && isLive;

  return (
    <>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, marginBottom: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 34, minWidth: 0 }}>
          {showBigClock
            ? <BigMatchCountdown clock={matchClock} />
            : (
              <div style={{ fontFamily: F_HEAD, fontWeight: 700, fontSize: 82, lineHeight: 0.9, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                {isResult ? 'Results' : 'On field'}
              </div>
            )}
          {/* The playoff label already says "Match", so the caption would
              read "MATCH Match 1" — there it carries the number alone. */}
          {data.matchPhase === 'playoff'
            ? <Badge label="Playoff" value={matchLabel(data.matchPhase, data.matchNumber)} />
            : <Badge label="Match" value={matchLabel(data.matchPhase, data.matchNumber)} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          <div style={{ ...OVER_GRADIENT, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontFamily: F_HEAD, fontWeight: 700, fontSize: 34, lineHeight: 1, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              FGC Uzbekistan 2026
            </div>
            <div style={{ fontFamily: F_MONO, fontSize: 17, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'oklch(1 0 0 / 0.88)' }}>
              {data.matchPhase === 'playoff' ? 'Playoff' : 'Qualification'} · Tashkent
            </div>
          </div>
          {isLive && !showBigClock && !showCenterClock && <MatchCountdown clock={matchClock} />}
        </div>
      </div>

      <style>{'@keyframes fgcPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }'}</style>

      <div style={{
        position: 'relative', flex: '1 1 0%', minHeight: 0, display: 'grid',
        gridTemplateColumns: showCenterClock ? '1fr auto 1fr' : '1fr 1fr',
        gap: showCenterClock ? 28 : 40,
      }}>
        <AlliancePanel color="red" data={data.red} isWinner={result?.winner === 'red'}
          shared={result ? { extinguisher: result.extinguisher, coopertition: result.coopertition } : null} />
        {showCenterClock && <CenterMatchCountdown clock={matchClock} />}
        <AlliancePanel color="blue" data={data.blue} isWinner={result?.winner === 'blue'}
          shared={result ? { extinguisher: result.extinguisher, coopertition: result.coopertition } : null} />
      </div>

      <Ticker label={nextMatchLabel} clock={clock} />
    </>
  );
}

/**
 * The match clock, sized for the back of the hall.
 *
 * The last 30 seconds turn amber and say ENDGAME: the whistle carries only so
 * far in a loud hall, and a team that misses it still sees the colour change
 * from the field. Before the referee starts the match the clock sits at 2:30
 * greyed out, so nothing on screen ever pretends a match is running.
 */
function MatchCountdown({ clock }: { clock: ReturnType<typeof useMatchClock> }) {
  const period = clock?.period ?? 'pre';
  // Endgame and time-up are filled solid, not tinted: a translucent panel over
  // the event's pink gradient washes out at the back of a bright hall, and
  // those are the two moments the hall must not miss.
  const theme = period === 'countdown'
    ? { bg: 'oklch(1 0 0 / 0.2)', border: 'oklch(1 0 0 / 0.7)', text: 'oklch(1 0 0)', caption: 'Get ready' }
    : period === 'endgame'
    ? { bg: 'oklch(0.82 0.17 82)', border: 'oklch(0.88 0.15 85)', text: 'oklch(0.25 0.06 60)', caption: 'Endgame' }
    : period === 'over'
      ? { bg: 'oklch(0.55 0.22 25)', border: 'oklch(0.65 0.22 25)', text: 'oklch(1 0 0)', caption: 'Time' }
      : period === 'pre'
        ? { bg: 'oklch(1 0 0 / 0.08)', border: 'oklch(1 0 0 / 0.3)', text: 'oklch(1 0 0 / 0.6)', caption: 'Ready' }
        : { bg: 'oklch(0.6 0.21 25 / 0.16)', border: 'oklch(0.62 0.21 25 / 0.55)', text: 'oklch(1 0 0)', caption: 'Live' };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      // The canvas is a fixed 1920x1080: a taller clock here pushes the
      // alliance panels' TOTAL row off the bottom of the screen. This is as
      // large as the digits go without costing the hall the scores.
      padding: '10px 26px', borderRadius: 12, minWidth: 310,
      background: theme.bg, border: `1px solid ${theme.border}`,
      animation: period === 'endgame' ? 'fgcPulse 1s ease-in-out infinite' : undefined,
    }}>
      <span style={{
        fontFamily: F_MONO, fontSize: 17, fontWeight: 700, letterSpacing: '0.28em',
        textTransform: 'uppercase', color: theme.text, opacity: 0.92,
      }}>
        {theme.caption}
      </span>
      <span style={{
        fontFamily: F_MONO, fontSize: 74, fontWeight: 700, lineHeight: 1,
        letterSpacing: '0.02em', color: theme.text, fontVariantNumeric: 'tabular-nums',
      }}>
        {clock?.label ?? '2:30'}
      </span>
    </div>
  );
}

/**
 * The alternative clock: the countdown takes the place of the "ON FIELD"
 * title, so the digits get the height that decoration was using instead of
 * pushing the alliance panels off the fixed 1920x1080 canvas. Same colours and
 * same endgame rules as the header version — only the size differs.
 */
function BigMatchCountdown({ clock }: { clock: ReturnType<typeof useMatchClock> }) {
  const period = clock?.period ?? 'pre';
  const theme = period === 'countdown'
    ? { digits: 'oklch(1 0 0)', caption: 'Get ready', captionColor: 'oklch(1 0 0 / 0.85)' }
    : period === 'endgame'
    ? { digits: 'oklch(0.86 0.17 82)', caption: 'Endgame', captionColor: 'oklch(0.86 0.17 82)' }
    : period === 'over'
      ? { digits: 'oklch(0.72 0.2 25)', caption: 'Time', captionColor: 'oklch(0.72 0.2 25)' }
      : period === 'pre'
        ? { digits: 'oklch(1 0 0 / 0.55)', caption: 'Ready', captionColor: 'oklch(1 0 0 / 0.6)' }
        : { digits: 'oklch(1 0 0)', caption: 'On field', captionColor: 'oklch(1 0 0 / 0.8)' };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      animation: period === 'endgame' ? 'fgcPulse 1s ease-in-out infinite' : undefined,
    }}>
      <span style={{
        fontFamily: F_MONO, fontSize: 22, fontWeight: 700, letterSpacing: '0.32em',
        textTransform: 'uppercase', color: theme.captionColor,
      }}>
        {theme.caption}
      </span>
      <span style={{
        fontFamily: F_MONO, fontSize: 132, fontWeight: 700, lineHeight: 0.92,
        letterSpacing: '-0.01em', color: theme.digits, fontVariantNumeric: 'tabular-nums',
        textShadow: 'oklch(0.25 0.08 340 / 0.45) 0px 6px 26px',
      }}>
        {clock?.label ?? '2:30'}
      </span>
    </div>
  );
}

/**
 * The third clock: down the middle of the field, between the two alliances,
 * the way a field display is read at a robotics event — the digits sit where
 * everyone in the hall is already looking, and get a whole column's height
 * instead of borrowing from the header.
 */
function CenterMatchCountdown({ clock }: { clock: ReturnType<typeof useMatchClock> }) {
  const period = clock?.period ?? 'pre';
  const theme = period === 'countdown'
    ? { digits: 'oklch(1 0 0)', caption: 'Get ready' }
    : period === 'endgame'
    ? { digits: 'oklch(0.88 0.17 84)', caption: 'Endgame' }
    : period === 'over'
      ? { digits: 'oklch(0.72 0.21 25)', caption: 'Time' }
      : period === 'pre'
        ? { digits: 'oklch(1 0 0 / 0.5)', caption: 'Ready' }
        : { digits: 'oklch(1 0 0)', caption: 'On field' };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 10, width: 500, padding: '0 8px',
      animation: period === 'endgame' ? 'fgcPulse 1s ease-in-out infinite' : undefined,
    }}>
      <span style={{
        fontFamily: F_MONO, fontSize: 34, fontWeight: 700, letterSpacing: '0.34em',
        textTransform: 'uppercase', color: theme.digits, opacity: 0.85,
      }}>
        {theme.caption}
      </span>
      <span style={{
        fontFamily: F_MONO, fontSize: 210, fontWeight: 700, lineHeight: 0.92,
        letterSpacing: '-0.03em', color: theme.digits, fontVariantNumeric: 'tabular-nums',
        textShadow: 'oklch(0.2 0.06 340 / 0.55) 0px 8px 34px',
      }}>
        {clock?.label ?? '2:30'}
      </span>
    </div>
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
  // A 3px outline was invisible from the back of the hall, and on the event
  // gradient it had even less to contrast against — the winner is now marked
  // by a thick bright ring plus a glow that reads at a distance.
  const winOutline = color === 'red' ? 'oklch(0.97 0.13 95)' : 'oklch(0.95 0.12 195)';

  return (
    <section style={{
      position: 'relative', display: 'flex', flexDirection: 'column', borderRadius: 20, overflow: 'hidden',
      background: theme.gradient, boxShadow: theme.shadow,
      ...(isWinner
        ? {
            outline: `${winOutline} solid 10px`,
            outlineOffset: -10,
            boxShadow: `${theme.shadow}, 0 0 0 6px oklch(1 0 0 / 0.35), 0 0 60px 10px ${winOutline}`,
          }
        : {}),
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, height: 62,
        padding: isWinner ? '0 0 0 30px' : '0 30px', background: 'oklch(0 0 0 / 0.14)',
        ...(isWinner ? { borderBottom: `3px solid ${winOutline}` } : {}),
      }}>
        <div style={{ fontFamily: F_MONO, fontSize: 21, fontWeight: 600, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'oklch(1 0 0 / 0.9)' }}>
          {theme.label}
        </div>
        {isWinner && (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 34px', background: winOutline, color: 'oklch(0.2 0.02 250)' }}>
            <div style={{ fontFamily: F_HEAD, fontWeight: 700, fontSize: 44, lineHeight: 1, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Win</div>
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
          <div style={{ ...OVER_GRADIENT, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 3 }}>
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

      <div style={{ ...OVER_GRADIENT, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, marginTop: 20, padding: '12px 22px' }}>
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
