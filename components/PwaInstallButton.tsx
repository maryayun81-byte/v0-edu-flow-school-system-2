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
  const [isMobile, setIsMobile] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showAndroidModal, setShowAndroidModal] = useState(false);

  useEffect(() => {
    // Already installed as PWA?
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (standalone) { setIsInstalled(true); return; }

    // Detection
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi|Tablet/i.test(ua);
    
    setIsIOS(ios);
    setIsMobile(mobile);

    // On mobile, we force visibility because native prompts are flaky or non-existent (Safari)
    if (mobile || ios) {
      setIsInstallable(true);
      setTimeout(() => setShowBanner(true), 3000);
    }

    // Chrome / Edge beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
      // If native prompt is available, we use that over forcing the banner early
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
    
    if (!deferredPrompt) {
      // If we're on mobile and don't have a prompt, show manual instructions
      if (isMobile) {
        setShowAndroidModal(true);
      }
      return;
    }

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

  // If already installed, hide everything
  if (isInstalled) return null;
  
  // For the auto-banner, only show if we detected it's installable
  if (variant === 'banner' && !isInstallable) return null;

  // iOS step-by-step modal
  const IOSModal = showIOSModal ? (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground">Install on iOS</h3>
          </div>
          <button onClick={() => setShowIOSModal(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <ol className="space-y-3 text-sm text-muted-foreground">
          {[
            <>Tap the <strong className="text-foreground text-xs uppercase bg-primary/10 px-1 rounded">Share</strong> button (⬆) in Safari</>,
            <>Scroll down and tap <strong className="text-foreground text-xs uppercase bg-primary/10 px-1 rounded">"Add to Home Screen"</strong></>,
            <>Tap <strong className="text-foreground text-xs uppercase bg-primary px-1 rounded text-white">"Add"</strong> in the top-right</>,
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

  // Android / Other manual modal
  const AndroidModal = showAndroidModal ? (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground text-sm uppercase tracking-wide">Manual Installation</h3>
          </div>
          <button onClick={() => setShowAndroidModal(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="mb-4 p-3 bg-primary/5 border border-primary/10 rounded-xl">
          <p className="text-xs text-primary font-medium">Try this if the "Install" button didn't work:</p>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">For Chrome & Edge</p>
            <ol className="space-y-1.5 text-xs text-muted-foreground">
              <li>1. Tap the <strong className="text-foreground">Menu</strong> (3 dots)</li>
              <li>2. Tap <strong className="text-foreground">"Install app"</strong> or <strong className="text-foreground">"Add to Home screen"</strong></li>
            </ol>
          </div>
          
          <div>
            <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">For Samsung Internet</p>
            <ol className="space-y-1.5 text-xs text-muted-foreground">
              <li>1. Tap the <strong className="text-foreground">Menu</strong> (3 lines)</li>
              <li>2. Tap <strong className="text-foreground">"Add page to"</strong> &gt; <strong className="text-foreground">"Home screen"</strong></li>
            </ol>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">For Firefox</p>
            <ol className="space-y-1.5 text-xs text-muted-foreground">
              <li>1. Tap the <strong className="text-foreground">Menu</strong> (3 dots)</li>
              <li>2. Tap <strong className="text-foreground">"Install"</strong> (external link icon)</li>
            </ol>
          </div>
        </div>

        <button onClick={() => setShowAndroidModal(false)} className="w-full mt-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors">
          I Understand
        </button>
      </div>
    </div>
  ) : null;

  // ── Inline button (hero) ──────────────────────────────────────────────
  if (variant === 'button') {
    return (
      <>
        {IOSModal}
        {AndroidModal}
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
      {AndroidModal}
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
