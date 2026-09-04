import Link from 'next/link';
import StandingsTable from './StandingsTable';
import { EVENT_BACKGROUND, gridTexture } from '@/lib/brand';

/**
 * The public board: the event's own colours, with the heading FIRST Global
 * puts on its results page — the event named in full, its dates and city
 * underneath, and one button on the right.
 *
 * The button goes to the projector screen rather than to a stream, which is
 * the nearest thing this event has to their "Watch Live".
 */
export default function HomePage() {
  return (
    <div className="min-h-screen text-gray-900" style={{ background: EVENT_BACKGROUND }}>
      <div style={{ ...gridTexture(0.05), position: 'fixed' }} />
      <header className="relative px-4 sm:px-8 pt-6 sm:pt-10 pb-5 sm:pb-8 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-4xl font-bold text-white leading-tight drop-shadow">
            2026 <em className="not-italic">FIRST</em> Global Challenge Uzbekistan
          </h1>
          <p className="mt-1 text-xs sm:text-base text-white/85">
            5–6 September 2026 in Tashkent
          </p>
        </div>
        {/* White on the gradient rather than blue: a blue pill on a pink-to-blue
            ground disappears into whichever end it happens to sit over. */}
        <Link
          href="/display"
          className="shrink-0 rounded-full bg-white/95 hover:bg-white text-gray-900 text-xs sm:text-base font-semibold px-4 sm:px-6 py-2 sm:py-2.5 shadow-sm transition-colors"
        >
          Field display
        </Link>
      </header>
      <main className="relative px-3 sm:px-8 pb-8">
        <StandingsTable />
      </main>
    </div>
  );
}
