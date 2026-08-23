'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import InstallPrompt from './InstallPrompt';

const PUBLIC_PATHS = ['/login', '/signup', '/about', '/terms', '/privacy', '/forgot-password'];
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

function formatBannedUntil(dateString) {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function RequireAuth({ children }) {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [bannedUntil, setBannedUntil] = useState(null);
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

    supabase.auth.getUser().then(async ({ data }) => {
      const currentUser = data?.user || null;

      if (currentUser) {
        const profileResult = await supabase
          .from('profiles')
          .select('banned_until')
          .eq('id', currentUser.id)
          .single();

        const bu = profileResult.data ? profileResult.data.banned_until : null;
        if (bu && new Date(bu) > new Date()) {
          setBannedUntil(bu);
          setUser(null);
          setChecking(false);
          await supabase.auth.signOut();
          return;
        }
      }

      setUser(currentUser);
      setChecking(false);
      if (!currentUser) handleNoUser();
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

  if (bannedUntil) {
    return (
      <div className="max-w-sm mx-auto py-16 text-center px-4">
        <h1 className="text-xl font-bold text-red-700 mb-2">Account temporarily suspended</h1>
        <p className="text-sm text-stone-600">
          Your account is suspended until {formatBannedUntil(bannedUntil)}. You can log back in after that.
        </p>
      </div>
    );
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
