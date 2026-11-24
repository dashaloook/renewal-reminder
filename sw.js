// Renewal Reminder — service worker for browser push notifications.
// The daily job on the server sends a push message; the browser wakes this
// worker up (even when the app's tab is closed) and it shows the notification.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data && event.data.text() }; }
  const title = data.title || 'Renewal Reminder';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || 'A renewal is coming up. Open the app to decide.',
    icon: '/duck-wave.png',
    badge: '/duck-wave.png',
    tag: data.tag || 'renewal',
    data: { url: data.url || '/#/dashboard' },
  }));
});

// Clicking the notification opens the app (or focuses it if it's already open).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/#/dashboard', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    const open = wins.find((w) => w.url.startsWith(self.location.origin));
    if (open) { open.navigate(url); return open.focus(); }
    return self.clients.openWindow(url);
  }));
});
