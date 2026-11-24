// Firebase web config — public by design (it is not a secret key).
// It only tells the app which Firebase project to use. The data is protected by
// firestore.rules (each user can only reach their own document), and Google
// sign-in only works on the domains allowed in Firebase → Authentication → Settings.
// Set it to null to switch real Google sign-in off.
window.RR_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyA7XpUu145kJ_gs5LUi0ShqhU06FzuwJss',
  authDomain: 'renewal-reminder-33e59.firebaseapp.com',
  projectId: 'renewal-reminder-33e59',
  storageBucket: 'renewal-reminder-33e59.firebasestorage.app',
  messagingSenderId: '833438435146',
  appId: '1:833438435146:web:4a65eab708e6545ae323b3',
};
