// =============================================================
// config.js — the ONE place for app-wide settings.
//
// Change APP_NAME here to rename the whole site.
// Paste your Firebase web config into firebaseConfig (see README).
//
// Is it safe to put the Firebase config in a PUBLIC repo? YES.
// These values only tell the browser WHICH Firebase project to
// talk to. They are not passwords. What actually protects your data
// is the security rules in firebase/database.rules.json, plus the
// "Authorized domains" list in Firebase Authentication.
// Never put a service-account key or admin secret in this repo.
// =============================================================

export const APP_NAME = 'FlashGames';
export const APP_TAGLINE = 'Party games for the squad. No download, no wahala.';

export const firebaseConfig = {
  apiKey: 'PASTE_YOUR_API_KEY',
  authDomain: 'PASTE_YOUR_PROJECT.firebaseapp.com',
  databaseURL: 'https://PASTE_YOUR_PROJECT-default-rtdb.firebaseio.com',
  projectId: 'PASTE_YOUR_PROJECT',
  storageBucket: 'PASTE_YOUR_PROJECT.appspot.com',
  messagingSenderId: 'PASTE_YOUR_SENDER_ID',
  appId: 'PASTE_YOUR_APP_ID',
};

// Local testing with the Firebase Emulator (see README, "Test locally").
// When you open the site on localhost with ?emulator=1 in the address,
// the app talks to the emulator on your computer instead of the real project.
export const EMULATOR = {
  host: '127.0.0.1',
  databasePort: 9000,
  authPort: 9099,
};

// True once you have replaced the placeholder values above.
export function isFirebaseConfigured() {
  return !firebaseConfig.apiKey.startsWith('PASTE_');
}
