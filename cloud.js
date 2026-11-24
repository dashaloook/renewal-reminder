// Renewal Reminder — real accounts with Firebase (Google sign-in + Firestore).
//
// Security model
// - The Firebase web config (firebase-config.js) is NOT a secret: it only says which
//   Firebase project to talk to. It is meant to be public.
// - What protects the data are the Firestore rules (firestore.rules): a signed-in user
//   can read and write only the document users/{their own uid}. Nobody else can.
// - Google sign-in only works on domains listed in Firebase → Authentication →
//   Authorized domains (localhost and the Vercel site), so other sites can't use it.
//
// If firebase-config.js has no config, cloud features are switched off and the app
// keeps working as before (demo + simulated sign-in).
(function () {
  const cfg = window.RR_FIREBASE_CONFIG;
  const enabled = !!(cfg && cfg.apiKey && cfg.projectId && window.firebase);
  let auth = null; let db = null;

  if (enabled) {
    firebase.initializeApp(cfg);
    auth = firebase.auth();
    db = firebase.firestore();
  }

  // Only these fields are stored in the cloud; everything else stays local.
  const FIELDS = ['reminders', 'stats', 'onboarded', 'notif', 'bannerDismissed'];
  const pick = (s) => FIELDS.reduce((o, k) => (s[k] !== undefined ? { ...o, [k]: s[k] } : o), {});
  // Firestore rejects `undefined` values; JSON round-trip drops them.
  const clean = (o) => JSON.parse(JSON.stringify(o));

  const friendly = (e) => {
    const c = (e && e.code) || '';
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return null; // user changed their mind: no error
    if (c === 'auth/popup-blocked') return 'Your browser blocked the Google window. Allow pop-ups for this site and try again.';
    if (c === 'auth/unauthorized-domain') return 'Google sign-in isn’t allowed on this address yet (Firebase → Authentication → Authorized domains).';
    if (c === 'auth/network-request-failed' || c === 'unavailable') return 'No connection. Check your internet and try again.';
    if (c === 'permission-denied') return 'You don’t have access to this data.';
    return 'Something went wrong with Google sign-in. Try again.';
  };

  const toUser = (u) => {
    const name = u.displayName || (u.email || 'You').split('@')[0];
    return { uid: u.uid, name, first: name.split(' ')[0], email: u.email || '', photo: u.photoURL || '', initials: name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() };
  };

  const ref = (uid) => db.collection('users').doc(uid);

  window.RRCloud = {
    enabled,
    friendly,
    toUser,
    // Opens the real Google window. Resolves with the user, or null if they closed it.
    async signInWithGoogle() {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const res = await auth.signInWithPopup(provider);
      return res.user ? toUser(res.user) : null;
    },
    // Fresh Google sign-in token for our own server (proves who is asking). null if signed out.
    idToken: () => (auth && auth.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(null)),
    signOut: () => (auth ? auth.signOut() : Promise.resolve()),
    // Calls cb(user | null) now and whenever the session changes (e.g. after a reload).
    onUser: (cb) => (auth ? auth.onAuthStateChanged((u) => cb(u ? toUser(u) : null)) : () => {}),
    async load(uid) {
      const snap = await ref(uid).get();
      return snap.exists ? snap.data() : null;
    },
    save(uid, state) {
      return ref(uid).set({ ...clean(pick(state)), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    },
  };
})();
