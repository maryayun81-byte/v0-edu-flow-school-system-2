"use client";

import { useState, useEffect } from "react";
import { Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PwaInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if running as standalone (installed)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream);

    // Listen for install prompt
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setDeferredPrompt(null);
    } else {
      console.log('User dismissed the install prompt');
    }
  };

  if (isInstalled) return null;

  if (isIOS) {
    return (
      <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg flex items-center gap-2">
        <Smartphone className="w-4 h-4" />
        <span>Install: Share <Download className="w-3 h-3 inline" /> → Add to Home Screen</span>
      </div>
    );
  }

  if (!deferredPrompt) return null;

  return (
    <Button 
      onClick={handleInstallClick}
      variant="outline" 
      size="sm" 
      className="gap-2 bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"
    >
      <Download className="w-4 h-4" />
      Install App
    </Button>
  );
}
