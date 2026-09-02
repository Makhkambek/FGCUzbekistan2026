import StandingsTable from './StandingsTable';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 h-14 sm:h-16 flex items-center px-4 sm:px-8">
        <div>
          <h1 className="text-lg sm:text-xl font-bold leading-tight">FGC Uzbekistan 2026</h1>
          <p className="text-xs text-gray-500 leading-tight">Igniting Innovation · результаты и рейтинг</p>
        </div>
      </header>
      <main className="p-4 sm:p-8">
        <StandingsTable />
      </main>
    </div>
  );
}
