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
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: data.tag || 'renewal',
    requireInteraction: !!data.id, // stays on screen until you act on it
    data: { url: data.url || '/#/dashboard', id: data.id || null },
    // Buttons inside the notification: Chrome/Edge show up to 2. Safari shows none (clicking opens the app).
    actions: data.id ? [{ action: 'keep', title: 'Keep it' }, { action: 'later', title: 'Decide later' }] : [],
  }));
});

// Clicking the notification opens the app on that reminder; a button opens it with the decision
// (Keep it = marked as kept, with Undo; Decide later = the postpone dialog).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const url = new URL(d.url || '/#/dashboard', self.location.origin);
  if (d.id) { url.searchParams.set('open', d.id); url.searchParams.set('act', event.action || 'open'); }
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    const open = wins.find((w) => w.url.startsWith(self.location.origin));
    if (open) return open.navigate(url.href).then((w) => (w || open).focus());
    return self.clients.openWindow(url.href);
  }));
});
