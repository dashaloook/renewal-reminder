// Firebase web config — public by design (it is not a secret key).
// It only tells the app which Firebase project to use. The data is protected by
// firestore.rules (each user can only reach their own data), and sign-in only works
// on the domains allowed in Firebase → Authentication → Settings → Authorized domains.
//
// Two projects, so testing never touches real users' data:
//   - renewduck.vercel.app (the live site)       → renewal-reminder-33e59 (live)
//   - everything else (localhost, test previews) → renewal-reminder-test (test)
// Set RR_FIREBASE_CONFIG to null to switch real sign-in off (demo mode only).
(function () {
  const LIVE = {
    apiKey: 'AIzaSyA7XpUu145kJ_gs5LUi0ShqhU06FzuwJss',
    // Our own address, so Google's sign-in window says renewduck.vercel.app. vercel.json passes
    // /__/auth/* through to Firebase; the address is registered in Google Cloud → Credentials.
    authDomain: 'renewduck.vercel.app',
    projectId: 'renewal-reminder-33e59',
    storageBucket: 'renewal-reminder-33e59.firebasestorage.app',
    messagingSenderId: '833438435146',
    appId: '1:833438435146:web:4a65eab708e6545ae323b3',
  };
  const TEST = {
    apiKey: 'AIzaSyAvz4AhL-CW2nVecyzpOd5Ep_OKGDI3cCI',
    authDomain: 'renewal-reminder-test.firebaseapp.com',
    projectId: 'renewal-reminder-test',
    storageBucket: 'renewal-reminder-test.firebasestorage.app',
    messagingSenderId: '260157270972',
    appId: '1:260157270972:web:ab99310a5e6a642c2fd9b9',
  };
  // The live site's addresses (the old one still works and must keep using live data).
  const live = ['renewduck.vercel.app', 'renewal-reminder-one.vercel.app'].includes(location.hostname);
  window.RR_FIREBASE_CONFIG = live ? LIVE : TEST;
  window.RR_ENV = live ? 'live' : 'test';
})();
