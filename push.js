// Renewal Reminder — real browser notifications.
//
// How it works
// - enable(): asks the browser for permission, registers the service worker (sw.js)
//   and creates a push subscription with our public VAPID key. For real accounts the
//   subscription is saved in the user's own Firestore document, so the daily job on
//   the server can send a push even when the app is closed.
// - test(): shows a notification right away on this device.
// - The VAPID public key below is public by design. The private key stays on the
//   server (VAPID_PRIVATE_KEY in Vercel) and is never in this code.
(function () {
  // Live and test use different key pairs (the test private key is set only for Vercel Preview).
  // Read when used: firebase-config.js (which sets RR_ENV) loads after this file.
  const VAPID_PUBLIC_KEY = () => window.RR_ENV === 'test'
    ? 'BNFEa-KssKRr_LPpZw-kJZbE1kWtotHuMEyFkUVAOeynCWqMiGNiX7KkqXxMJ6Chj2KICG3dbYrHqT1mD6NIBbI'
    : 'BAM_ONFCbXCYU0Jb3ab1XPXaPD1XDAtaI7IA3Mv0B6--FDzkQkTVrEem61QGwqkxctCrH26j1mhhGevctRv-niw';
  const supported = 'Notification' in window && 'serviceWorker' in navigator;
  const canPush = supported && 'PushManager' in window;

  const b64ToBytes = (s) => {
    const p = '='.repeat((4 - (s.length % 4)) % 4); const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  };
  const permission = () => (supported ? Notification.permission : 'unsupported'); // 'granted' | 'denied' | 'default' | 'unsupported'
  const registration = async () => {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready; return reg;
  };

  // Returns { ok, subscription?, error? }. Never throws.
  async function enable() {
    if (!supported) return { ok: false, error: 'This browser can’t show notifications.' };
    let p = Notification.permission;
    if (p === 'default') p = await Notification.requestPermission();
    if (p !== 'granted') return { ok: false, error: p === 'denied' ? 'Notifications are blocked for this site. Allow them in your browser’s site settings (the icon left of the address), then try again.' : 'You didn’t allow notifications.' };
    try {
      const reg = await registration();
      if (!canPush) return { ok: true };
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY()) });
      return { ok: true, subscription: sub.toJSON() };
    } catch (e) {
      // Permission is granted, but this browser couldn't subscribe to push (e.g. private window).
      return { ok: true, error: 'Notifications work while the app is open, but this browser couldn’t sign up for background push.' };
    }
  }

  // Buttons inside the notification (Chrome/Edge show up to 2; Safari shows none, so clicking opens the app).
  const tr = (s) => (window.RRI18n ? window.RRI18n.t(s) : s);
  const ACTIONS = () => [{ action: 'keep', title: tr('Keep it') }, { action: 'later', title: tr('Decide later') }];
  async function show(title, body, tag, reminderId) {
    if (permission() !== 'granted') return false;
    const opts = { body, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', tag: tag || 'test', requireInteraction: !!reminderId,
      data: { url: '/#/dashboard', id: reminderId || null }, ...(reminderId ? { actions: ACTIONS() } : {}) };
    try { const reg = await registration(); await reg.showNotification(title, opts); return true; }
    catch (e) { try { new Notification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png' }); return true; } catch (x) { return false; } }
  }

  window.RRPush = { supported, canPush, permission, enable, show };
})();
