import { Capacitor } from '@capacitor/core';
export function registerPwa() {
  if (Capacitor.isNativePlatform() || !window.isSecureContext || !('serviceWorker' in navigator)) return;
  const link = document.createElement('link');
  link.rel = 'manifest'; link.href = '/manifest.webmanifest'; document.head.appendChild(link);
  // No skipWaiting: a deployment cannot replace the worker during a card operation.
  void navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(() => {});
}
