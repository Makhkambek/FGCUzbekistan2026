import StandingsTable from './StandingsTable';
import { EVENT_BACKGROUND, gridTexture } from '@/lib/brand';

export default function HomePage() {
  return (
    <div className="min-h-screen text-gray-900" style={{ background: EVENT_BACKGROUND }}>
      <div style={{ ...gridTexture(0.05), position: 'fixed' }} />
      <header className="relative px-4 sm:px-8 pt-5 sm:pt-7 pb-4 sm:pb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] sm:text-xs font-mono font-semibold tracking-[0.35em] uppercase text-white/90">
            Uzbekistan
          </p>
          <h1 className="text-2xl sm:text-4xl font-bold uppercase tracking-wide text-white leading-none mt-1 drop-shadow">
            Qualification
          </h1>
        </div>
        {/* Hidden on a phone: at 390px it ran off the edge next to the title.
            The event name is on the title bar of the page anyway. */}
        <div className="hidden sm:block text-right text-white shrink-0">
          <p className="text-sm sm:text-lg font-bold uppercase leading-tight">FGC Uzbekistan 2026</p>
          <p className="text-[10px] sm:text-xs font-mono uppercase tracking-[0.2em] text-white/85 leading-tight">
            Igniting Innovation · Tashkent
          </p>
        </div>
      </header>
      <main className="relative px-3 sm:px-8 pb-8">
        <StandingsTable />
      </main>
    </div>
  );
}
