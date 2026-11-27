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

  // Profile fields live in users/{uid}; each reminder is its own record in users/{uid}/reminders/{id}.
  const FIELDS = ['stats', 'onboarded', 'notif', 'bannerDismissed', 'currency', 'lang'];
  const R_FIELDS = ['id', 'name', 'category', 'amount', 'cycle', 'date', 'remind', 'channel', 'link', 'note', 'status', 'reason', 'followUp', 'tone', 'history', 'emailedOn'];
  const pickR = (r) => clean(R_FIELDS.reduce((o, k) => (r[k] !== undefined ? { ...o, [k]: r[k] } : o), {}));
  const sameR = (a, b) => JSON.stringify(pickR(a)) === JSON.stringify(pickR(b));
  const validId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(id);
  const pick = (s) => FIELDS.reduce((o, k) => (s[k] !== undefined ? { ...o, [k]: s[k] } : o), {});
  // Firestore rejects `undefined` values; JSON round-trip drops them.
  const clean = (o) => JSON.parse(JSON.stringify(o));

  const friendly = (e) => {
    const c = (e && e.code) || '';
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return null; // user changed their mind: no error
    if (c === 'auth/popup-blocked') return 'Your browser blocked the Google window. Allow pop-ups for this site and try again.';
    if (c === 'auth/unauthorized-domain') return 'Sign-in isn’t allowed on this address yet (Firebase → Authentication → Authorized domains).';
    if (c === 'auth/network-request-failed' || c === 'unavailable') return 'No connection. Check your internet and try again.';
    if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found' || c === 'auth/invalid-login-credentials') return 'Email or password is wrong. Check them and try again, or reset your password.';
    if (c === 'auth/email-already-in-use') return 'An account with this email already exists. Log in instead, or reset the password.';
    if (c === 'auth/weak-password') return 'This password is too easy to guess. Use at least 8 characters.';
    if (c === 'auth/invalid-email') return 'This doesn’t look like an email yet. Try the format name@example.com.';
    if (c === 'auth/too-many-requests') return 'Too many attempts. Wait a few minutes and try again.';
    if (c === 'auth/user-disabled') return 'This account is switched off. Contact the app owner.';
    if (c === 'auth/operation-not-allowed') return 'Email accounts aren’t switched on yet (Firebase → Authentication → Sign-in method).';
    if (c === 'permission-denied') return 'You don’t have access to this data.';
    if (c === 'auth/user-mismatch') return 'That’s a different Google account. Choose the account you want to delete.';
    if (c === 'auth/requires-recent-login') return 'For your security, log out, log in again, then delete the account.';
    return 'Something went wrong. Try again.';
  };

  const toUser = (u) => {
    const name = u.displayName || (u.email || 'You').split('@')[0];
    return { uid: u.uid, name, first: name.split(' ')[0], email: u.email || '', photo: u.photoURL || '', verified: !!u.emailVerified, provider: (u.providerData[0] || {}).providerId === 'password' ? 'email' : 'google', initials: name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() };
  };

  const ref = (uid) => db.collection('users').doc(uid);
  const remRef = (uid) => ref(uid).collection('reminders');
  const stamp = () => firebase.firestore.FieldValue.serverTimestamp();
  // Firestore allows 500 writes per batch; stay well below.
  async function commitInChunks(ops) {
    for (let i = 0; i < ops.length; i += 400) {
      const b = db.batch(); ops.slice(i, i + 400).forEach((op) => op(b)); await b.commit();
    }
  }

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
    // Real email accounts. New accounts get a confirmation email from Firebase.
    async signUpWithEmail(email, password, name) {
      const res = await auth.createUserWithEmailAndPassword(email, password);
      await res.user.updateProfile({ displayName: name });
      try { await res.user.sendEmailVerification(); } catch (e) { /* not critical: can be resent later */ }
      return toUser(auth.currentUser);
    },
    async signInWithEmail(email, password) {
      const res = await auth.signInWithEmailAndPassword(email, password);
      return toUser(res.user);
    },
    // Firebase emails a reset link. It never says whether the account exists (so nobody can probe emails).
    resetPassword: (email) => auth.sendPasswordResetEmail(email),
    resendVerification: () => (auth.currentUser ? auth.currentUser.sendEmailVerification() : Promise.resolve()),
    // Permanently delete the signed-in account. Order matters:
    // 1) confirm it's really the owner (Google popup, or the email account's password),
    // 2) delete their database document (reminders, push devices) while still signed in,
    //    because the rules only let a signed-in user delete their own document,
    // 3) delete the login itself. Afterwards no emails or notifications are sent.
    async deleteAccount(password) {
      const u = auth.currentUser;
      if (!u) throw { code: 'auth/no-current-user' };
      const isEmail = (u.providerData[0] || {}).providerId === 'password';
      if (isEmail) {
        await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, password || ''));
      } else {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account', login_hint: u.email || '' });
        const res = await u.reauthenticateWithPopup(provider);
        if (res.user.uid !== u.uid) throw { code: 'auth/user-mismatch' };
      }
      // Reminders are separate records: delete them first (deleting the profile doesn't delete them).
      const rs = await remRef(u.uid).get();
      await commitInChunks(rs.docs.map((d) => (b) => b.delete(d.ref)));
      await ref(u.uid).delete();
      await u.delete();
    },
    signOut: () => (auth ? auth.signOut() : Promise.resolve()),
    // Calls cb(user | null) now and whenever the session changes (e.g. after a reload).
    onUser: (cb) => (auth ? auth.onAuthStateChanged((u) => cb(u ? toUser(u) : null)) : () => {}),
    // Profile + every reminder record. Accounts saved in the old all-in-one format are moved
    // to one record per reminder here, once (then the old list is removed from the profile).
    async load(uid) {
      const [snap, rs] = await Promise.all([ref(uid).get(), remRef(uid).get()]);
      const profile = snap.exists ? snap.data() : null;
      let reminders = rs.docs.map((d) => d.data());
      const legacy = profile && Array.isArray(profile.reminders) ? profile.reminders.filter((r) => r && validId(r.id)) : null;
      if (legacy) {
        const have = new Set(reminders.map((r) => r.id));
        const move = legacy.filter((r) => !have.has(r.id));
        await commitInChunks(move.map((r) => (b) => b.set(remRef(uid).doc(r.id), { ...pickR(r), updatedAt: stamp() })));
        await ref(uid).update({ reminders: firebase.firestore.FieldValue.delete(), updatedAt: stamp() });
        reminders = [...reminders, ...move.map(pickR)];
      }
      if (!profile && !reminders.length) return null;
      const { reminders: _old, ...rest } = profile || {};
      return { ...rest, reminders };
    },
    // Settings and stats only (merge keeps push devices).
    saveProfile(uid, state) {
      return ref(uid).set({ ...clean(pick(state)), updatedAt: stamp() }, { merge: true });
    },
    // Write only what changed since the last sync: new/edited reminders are saved, removed ones deleted.
    // `synced` (Map id → reminder) is what the cloud has; it is updated only after a successful write,
    // so a failed save is retried next time. Another device's reminders are never touched.
    async syncReminders(uid, list, synced) {
      const now = new Map(list.filter((r) => validId(r.id)).map((r) => [r.id, r]));
      const ops = []; const done = [];
      now.forEach((r, id) => { const was = synced.get(id); if (!was || !sameR(was, r)) { ops.push((b) => b.set(remRef(uid).doc(id), { ...pickR(r), updatedAt: stamp() })); done.push(() => synced.set(id, r)); } });
      synced.forEach((_, id) => { if (!now.has(id)) { ops.push((b) => b.delete(remRef(uid).doc(id))); done.push(() => synced.delete(id)); } });
      if (!ops.length) return 0;
      await commitInChunks(ops); done.forEach((f) => f()); return ops.length;
    },
    // Live updates from other devices: cb([{ type: 'set'|'delete', id, reminder }]). Own pending writes are skipped.
    watchReminders(uid, cb) {
      return remRef(uid).onSnapshot((snap) => {
        const changes = snap.docChanges().filter((c) => !c.doc.metadata.hasPendingWrites)
          .map((c) => (c.type === 'removed' ? { type: 'delete', id: c.doc.id } : { type: 'set', id: c.doc.id, reminder: pickR(c.doc.data()) }));
        if (changes.length) cb(changes);
      }, () => {});
    },
    sameReminder: sameR,
    // Remember this device's push subscription (max 5 devices), so the daily job can notify it.
    async savePush(uid, sub) {
      if (!sub || !sub.endpoint) return;
      const snap = await ref(uid).get();
      const list = ((snap.exists && snap.data().push) || []).filter((s) => s && s.endpoint !== sub.endpoint);
      const keep = [...list, { endpoint: sub.endpoint, keys: sub.keys || {} }].slice(-5);
      return ref(uid).set({ push: keep, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    },
  };
})();
