import Link from 'next/link';
import StandingsTable from './StandingsTable';

/**
 * The public board, laid out the way FIRST Global lays out its own event
 * results page: a pale neutral ground, the event named in plain black type
 * with its dates and city beneath, one blue pill on the right, and everything
 * else inside a single white card.
 *
 * The projector keeps the event's gradient — it is seen from the back of a
 * hall and needs the colour. This page is read on a phone, held a foot from
 * the face, where the same gradient only competes with the numbers.
 */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#eef2f6] text-gray-900" style={{ fontFamily: 'var(--font-roboto), system-ui, sans-serif' }}>
      <header className="max-w-6xl mx-auto px-4 sm:px-8 pt-8 sm:pt-12 pb-6 sm:pb-8 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 leading-tight">
            2026 <em className="not-italic font-bold">FIRST</em> Global Challenge Uzbekistan
          </h1>
          <p className="mt-1 text-sm sm:text-base text-gray-500">
            5–6 September 2026 in Tashkent
          </p>
        </div>
        <Link
          href="/display"
          className="shrink-0 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base font-medium px-4 sm:px-6 py-2 sm:py-2.5 transition-colors"
        >
          Field display
        </Link>
      </header>
      <main className="max-w-6xl mx-auto px-3 sm:px-8 pb-12">
        <StandingsTable />
      </main>
    </div>
  );
}
