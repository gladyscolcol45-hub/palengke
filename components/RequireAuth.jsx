'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import InstallPrompt from './InstallPrompt';

const PUBLIC_PATHS = ['/login', '/signup', '/about', '/terms', '/privacy'];
const INSTALL_DISMISSED_KEY = 'palengke_install_dismissed';

// Shown once to first-time visitors, right when they open the app link and
// before they ever reach login/signup. Skipped if they're already using the
// installed app (standalone display mode) or already saw/dismissed it before.
function shouldShowInstallPrompt() {
  if (typeof window === 'undefined') return false;
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isStandalone) return false;
  try {
    return window.localStorage.getItem(INSTALL_DISMISSED_KEY) !== '1';
  } catch (e) {
    return true;
  }
}

function dismissInstallPrompt() {
  try {
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
  } catch (e) {
    // ignore — worst case the prompt shows again next visit
  }
}

export default function RequireAuth({ children }) {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    const supabase = createClient();

    function handleNoUser() {
      if (isPublic) return;
      if (shouldShowInstallPrompt()) {
        setShowInstall(true);
      } else {
        router.push('/login');
      }
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
      setChecking(false);
      if (!data?.user) handleNoUser();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (!session?.user) handleNoUser();
    });

    return () => listener.subscription.unsubscribe();
  }, [pathname, router, isPublic]);

  if (checking) {
    return <p className="text-stone-400 text-sm text-center py-12">Loading…</p>;
  }

  if (showInstall) {
    return (
      <InstallPrompt
        onContinue={function () {
          dismissInstallPrompt();
          setShowInstall(false);
          router.push('/login');
        }}
      />
    );
  }

  if (!user && !isPublic) {
    return null;
  }

  return children;
}
