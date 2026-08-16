cat > app/layout.js << 'EOF'
import './globals.css';
import Image from 'next/image';
import AuthNav from '@/components/AuthNav';
import RequireAuth from '@/components/RequireAuth';

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
        <header className="border-b border-stone-200 bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <a href="/" className="flex items-center">
            <Image src="/logo.png" alt="Palengke" width={140} height={40} priority />
          </a>
          <nav className="flex gap-4 text-sm items-center">
            <a href="/new-listing" className="text-stone-600 hover:text-green-700">Sell</a>
            <AuthNav />
          </nav>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-6">
          <RequireAuth>{children}</RequireAuth>
        </main>
      </body>
    </html>
  );
}
EOF