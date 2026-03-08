'use client';

import { useState, useEffect } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaInstallButtonProps {
  /** 'button' = inline hero button, 'banner' = auto-appearing fixed bottom banner */
  variant?: 'button' | 'banner';
}

export function PwaInstallButton({ variant = 'button' }: PwaInstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    // Already installed as PWA?
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (standalone) { setIsInstalled(true); return; }

    // iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (ios) {
      setIsIOS(true);
      setIsInstallable(true);
      setTimeout(() => setShowBanner(true), 2500);
      return;
    }

    // Chrome / Edge beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
      setTimeout(() => setShowBanner(true), 2500);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setShowBanner(false);
    });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) { setShowIOSModal(true); return; }
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
        setShowBanner(false);
        setDeferredPrompt(null);
      }
    } finally {
      setInstalling(false);
    }
  };

  if (isInstalled || !isInstallable) return null;

  // iOS step-by-step modal
  const IOSModal = showIOSModal ? (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground">Install on iPhone / iPad</h3>
          </div>
          <button onClick={() => setShowIOSModal(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <ol className="space-y-3 text-sm text-muted-foreground">
          {[
            <>Tap the <strong className="text-foreground">Share</strong> button (⬆) in Safari's toolbar</>,
            <>Scroll down and tap <strong className="text-foreground">"Add to Home Screen"</strong></>,
            <>Tap <strong className="text-foreground">"Add"</strong> in the top-right corner</>,
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0 font-bold">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <button onClick={() => setShowIOSModal(false)} className="w-full mt-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors">
          Got it!
        </button>
      </div>
    </div>
  ) : null;

  // ── Inline button (hero) ──────────────────────────────────────────────
  if (variant === 'button') {
    return (
      <>
        {IOSModal}
        <Button
          onClick={handleInstall}
          disabled={installing}
          variant="outline"
          size="lg"
          className="gap-2 bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 hover:border-primary/60 font-semibold shadow-md shadow-primary/10 hover:scale-105 transition-all duration-300"
        >
          {installing
            ? <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            : <Download className="w-4 h-4" />}
          {installing ? 'Installing…' : isIOS ? 'Add to Home Screen' : 'Install Free App'}
        </Button>
      </>
    );
  }

  // ── Auto-appearing bottom banner ──────────────────────────────────────
  return (
    <>
      {IOSModal}
      {showBanner && (
        <div className="fixed bottom-4 left-4 right-4 z-50 max-w-lg mx-auto">
          <div className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl p-4 shadow-2xl flex items-center gap-3">
            <div className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground text-sm">Install Peak Performance</p>
              <p className="text-xs text-muted-foreground truncate">Add to home screen · Works offline</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setShowBanner(false)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={handleInstall}
                disabled={installing}
                className="px-3 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors"
              >
                {installing ? '…' : 'Install'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default PwaInstallButton;
