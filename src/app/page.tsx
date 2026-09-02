import StandingsTable from './StandingsTable';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-100 text-gray-900 p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">FGC Uzbekistan 2026</h1>
        <p className="text-gray-500">Igniting Innovation · результаты и рейтинг</p>
      </header>
      <StandingsTable />
    </main>
  );
}
