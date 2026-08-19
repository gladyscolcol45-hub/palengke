import './globals.css';
import Image from 'next/image';
import AuthNav from '@/components/AuthNav';
import RequireAuth from '@/components/RequireAuth';
import FloatingSell from '@/components/FloatingSell';
import BottomNav from '@/components/BottomNav';
import HeaderSearch from '@/components/HeaderSearch';
import NotificationBell from '@/components/NotificationBell';
import { SearchProvider } from '@/components/SearchContext';

export const metadata = {
  title: 'Palengke',
  description: 'Buy and sell in your neighborhood',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#16a34a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900">
        <SearchProvider>
          <header className="border-b border-stone-200 bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
            <a href="/" className="flex items-center">
              <Image src="/logo-192.png" alt="Palengke" width={140} height={40} priority />
            </a>
            <nav className="flex gap-3 text-sm items-center">
              <HeaderSearch />
              <NotificationBell />
              <AuthNav />
            </nav>
          </header>
          <main className="max-w-5xl mx-auto px-4 py-6 pb-28">
            <RequireAuth>{children}</RequireAuth>
          </main>
          <FloatingSell />
          <BottomNav />
        </SearchProvider>
      </body>
    </html>
  );
}
