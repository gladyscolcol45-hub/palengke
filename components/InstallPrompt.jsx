'use client';

import { useEffect, useState } from 'react';

export default function InstallPrompt({ onContinue }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [showManualSteps, setShowManualSteps] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    function handleBeforeInstall(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // iOS Safari never fires beforeinstallprompt and has its own
    // "Add to Home Screen" flow via the Share sheet, so it always needs the
    // manual steps instead of a one-tap install button.
    const ua = window.navigator.userAgent || '';
    setIsIos(/iphone|ipad|ipod/i.test(ua));

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  async function handleInstallClick() {
    if (deferredPrompt) {
      setInstalling(true);
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setInstalling(false);
      setDeferredPrompt(null);
      if (choice.outcome === 'accepted') {
        onContinue();
      }
    } else {
      setShowManualSteps(true);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-b from-green-700 to-green-900 flex items-center justify-center px-6 py-10">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl p-6 text-center">
        <img src="/logo-192.png" alt="Palengke" className="w-20 h-20 mx-auto rounded-2xl mb-4" />
        <h1 className="text-xl font-bold text-stone-900 mb-1">Install Palengke</h1>
        <p className="text-sm text-stone-500 mb-6">
          Add Palengke to your home screen for faster access and a real app feel &mdash; no app
          store needed.
        </p>

        {!isIos ? (
          <button
            onClick={handleInstallClick}
            disabled={installing}
            className="w-full bg-green-700 text-white rounded-lg py-3 font-semibold hover:bg-green-800 disabled:opacity-50 mb-3"
          >
            {installing ? 'Installing…' : 'Install Palengke App'}
          </button>
        ) : (
          <button
            onClick={function () { setShowManualSteps(true); }}
            className="w-full bg-green-700 text-white rounded-lg py-3 font-semibold hover:bg-green-800 mb-3"
          >
            How to install
          </button>
        )}

        {showManualSteps && (
          <div className="text-left bg-stone-50 border border-stone-200 rounded-lg p-3 mb-3 text-sm text-stone-600">
            {isIos ? (
              <>
                <p className="font-medium text-stone-700 mb-1">On iPhone/iPad:</p>
                <p>1. Tap the Share icon (square with an arrow) at the bottom of Safari.</p>
                <p>2. Scroll down and tap &quot;Add to Home Screen&quot;.</p>
                <p>3. Tap &quot;Add&quot; in the top right to confirm.</p>
              </>
            ) : (
              <>
                <p className="font-medium text-stone-700 mb-1">To install manually:</p>
                <p>1. Tap your browser&apos;s menu (⋮).</p>
                <p>2. Choose &quot;Add to Home Screen&quot; or &quot;Install app&quot;.</p>
                <p>3. Tap &quot;Add&quot; or &quot;Install&quot; to confirm.</p>
              </>
            )}
          </div>
        )}

        <button
          onClick={onContinue}
          className="text-sm text-stone-500 hover:text-stone-700 underline"
        >
          Continue in browser
        </button>
      </div>
    </div>
  );
}
