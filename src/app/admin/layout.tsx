import AdminNav from './AdminNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <AdminNav />
      <main className="p-4 sm:p-8 space-y-6">{children}</main>
    </div>
  );
}
