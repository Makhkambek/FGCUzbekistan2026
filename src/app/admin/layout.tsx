import AdminNav from './AdminNav';
import TelegramQr from '../TelegramQr';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <AdminNav />
      <main className="p-4 sm:p-8 space-y-6">{children}</main>
      {/* Out of the way of the panels but on every admin page: the volunteer
          on the laptop is the one people ask where to find the channel.
          Hidden on small screens, where it would sit on top of the forms. */}
      <div className="hidden sm:block fixed bottom-4 right-4 z-20">
        <TelegramQr size={60} />
      </div>
    </div>
  );
}
