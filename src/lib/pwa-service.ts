// ============================================================
// SADA OS — PWA & MOBILE WEB APP CLIENT SERVICE
// Phase 9: Mobile Web App / PWA Experience & Web Push Infrastructure
// ============================================================

export interface PwaStatus {
  isSupported: boolean;
  isRegistered: boolean;
  isStandalone: boolean;
  isInstallable: boolean;
  isIos: boolean;
  pushPermission: NotificationPermission | "unsupported";
}

let deferredPrompt: any = null;
let installListeners: Array<(canInstall: boolean) => void> = [];

/**
 * Checks whether the current window is running in Standalone (installed PWA) mode.
 */
export function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  const isStandaloneMedia = window.matchMedia("(display-mode: standalone)").matches;
  const isIosStandalone = (window.navigator as any).standalone === true;
  return Boolean(isStandaloneMedia || isIosStandalone);
}

/**
 * Checks if the current client is iOS Safari.
 */
export function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/crios|fxios|chrome/.test(ua);
  return isIos && isSafari;
}

/**
 * Checks whether Web Push Notifications are supported on this browser.
 */
export function isWebPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/**
 * Returns current Notification permission state or "unsupported".
 */
export function getPushPermissionState(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

/**
 * Registers the SADA OS PWA Service Worker.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    registration.addEventListener("updatefound", () => {
      const installingWorker = registration.installing;
      if (installingWorker) {
        installingWorker.addEventListener("statechange", () => {
          if (
            installingWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            console.log("[SADA OS PWA] New update available; ready to reload.");
          }
        });
      }
    });

    return registration;
  } catch (err) {
    console.warn("[SADA OS PWA] Service worker registration notice:", err);
    return null;
  }
}

/**
 * Initializes the PWA beforeinstallprompt event capture.
 */
export function initPwaInstallPromptListener(): () => void {
  if (typeof window === "undefined") return () => {};

  const handleBeforeInstallPrompt = (e: Event) => {
    e.preventDefault();
    deferredPrompt = e;
    installListeners.forEach((fn) => fn(true));
  };

  const handleAppInstalled = () => {
    deferredPrompt = null;
    installListeners.forEach((fn) => fn(false));
  };

  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window.addEventListener("appinstalled", handleAppInstalled);

  return () => {
    window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.removeEventListener("appinstalled", handleAppInstalled);
  };
}

/**
 * Subscribes a listener to changes in PWA installability.
 */
export function onPwaInstallChange(callback: (canInstall: boolean) => void): () => void {
  installListeners.push(callback);
  if (deferredPrompt) callback(true);
  return () => {
    installListeners = installListeners.filter((cb) => cb !== callback);
  };
}

/**
 * Triggers native PWA install prompt if available.
 */
export async function promptPwaInstall(): Promise<{ outcome: "accepted" | "dismissed" | "unavailable" }> {
  if (!deferredPrompt) {
    return { outcome: "unavailable" };
  }

  try {
    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    deferredPrompt = null;
    installListeners.forEach((fn) => fn(false));
    return { outcome: choiceResult.outcome };
  } catch (_) {
    return { outcome: "unavailable" };
  }
}

/**
 * Requests Web Push notification permission and optionally subscribes.
 */
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Subscribes to Web Push notifications through the registered service worker.
 */
export async function subscribeToWebPush(
  registration?: ServiceWorkerRegistration
): Promise<{ success: boolean; subscription?: PushSubscription | null; error?: string }> {
  if (!isWebPushSupported()) {
    return { success: false, error: "Web push is not supported on this browser or platform." };
  }

  try {
    const swReg = registration || (await navigator.serviceWorker.ready);
    let subscription = await swReg.pushManager.getSubscription();

    if (!subscription) {
      // Subscribe userVisibleOnly
      subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
      });
    }

    return { success: true, subscription };
  } catch (err: any) {
    // Graceful fallback for browsers or insecure contexts
    console.warn("[subscribeToWebPush] Notice:", err?.message);
    return { success: false, error: err?.message || "Failed to subscribe to Web Push" };
  }
}

/**
 * Pure helper for unit testing PWA status calculations.
 */
export function getPwaStatusSummary(): PwaStatus {
  return {
    isSupported: typeof window !== "undefined" && "serviceWorker" in navigator,
    isRegistered: typeof navigator !== "undefined" && Boolean(navigator.serviceWorker?.controller),
    isStandalone: isStandaloneApp(),
    isInstallable: Boolean(deferredPrompt),
    isIos: isIosSafari(),
    pushPermission: getPushPermissionState(),
  };
}
