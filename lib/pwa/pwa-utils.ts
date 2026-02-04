// PWA Service Worker Registration and Management

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('Service Workers not supported');
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('ServiceWorker registered:', registration.scope);

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              showUpdateNotification();
            }
          });
        }
      });

      // Check for updates every hour
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
    } catch (error) {
      console.error('ServiceWorker registration failed:', error);
    }
  });
}

function showUpdateNotification() {
  if (typeof window === 'undefined') return;

  const updateBanner = document.createElement('div');
  updateBanner.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-card border border-border rounded-xl p-4 shadow-xl z-50 animate-slide-up';
  updateBanner.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="flex-1">
        <h3 class="font-semibold text-foreground mb-1">Update Available</h3>
        <p class="text-sm text-muted-foreground mb-3">A new version of Peak Performance Tutoring is available.</p>
        <button id="update-btn" class="px-4 py-2 bg-accent text-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">
          Update Now
        </button>
      </div>
      <button id="dismiss-update" class="text-muted-foreground hover:text-foreground">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  `;

  document.body.appendChild(updateBanner);

  document.getElementById('update-btn')?.addEventListener('click', () => {
    window.location.reload();
  });

  document.getElementById('dismiss-update')?.addEventListener('click', () => {
    updateBanner.remove();
  });
}

// PWA Install Prompt
let deferredPrompt: any = null;

export function setupInstallPrompt() {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallPrompt();
  });

  window.addEventListener('appinstalled', () => {
    console.log('PWA installed');
    deferredPrompt = null;
    hideInstallPrompt();
  });
}

function showInstallPrompt() {
  // Check if already installed or dismissed
  if (localStorage.getItem('pwa-install-dismissed') === 'true') return;
  if (window.matchMedia('(display-mode: standalone)').matches) return;

  const installBanner = document.createElement('div');
  installBanner.id = 'pwa-install-banner';
  installBanner.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-gradient-to-r from-primary/20 to-accent/20 backdrop-blur-xl border border-primary/30 rounded-xl p-4 shadow-xl z-50 animate-slide-up';
  installBanner.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
        <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      </div>
      <div class="flex-1">
        <h3 class="font-semibold text-foreground mb-1">Install Peak Performance</h3>
        <p class="text-sm text-muted-foreground mb-3">Get the full app experience with offline access and notifications.</p>
        <div class="flex gap-2">
          <button id="install-btn" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            Install
          </button>
          <button id="dismiss-install" class="px-4 py-2 text-muted-foreground hover:text-foreground text-sm font-medium">
            Not Now
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(installBanner);

  document.getElementById('install-btn')?.addEventListener('click', async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    deferredPrompt = null;
    hideInstallPrompt();
  });

  document.getElementById('dismiss-install')?.addEventListener('click', () => {
    localStorage.setItem('pwa-install-dismissed', 'true');
    hideInstallPrompt();
  });
}

function hideInstallPrompt() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    banner.remove();
  }
}

// Check if app is installed
export function isPWAInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return Notification.permission;
}

// Subscribe to push notifications
export async function subscribeToPushNotifications(userId: string): Promise<PushSubscription | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      // Subscribe to push notifications
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.error('VAPID public key not configured');
        return null;
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    // Send subscription to server
    await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        subscription,
      }),
    });

    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    return null;
  }
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Background sync for messages
export async function syncMessages() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await (registration as any).sync.register('sync-messages');
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Background sync for notifications
export async function syncNotifications() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await (registration as any).sync.register('sync-notifications');
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}
