// =============================================================
// app.js — the starting point of the app.
//
// index.html loads this file. It applies the saved theme, then
// (for milestone a) runs a connection check so you can see that
// Firebase sign-in and the database both work.
// Later milestones replace the check with the real home screen.
// =============================================================

import { APP_NAME, APP_TAGLINE, isFirebaseConfigured } from './config.js';
import { el, mount, toast } from './ui.js';

const app = document.getElementById('app');
document.title = APP_NAME;
document.getElementById('brand-name').textContent = APP_NAME;

// ---------- Light / dark mode ----------
// Saved in localStorage so it is remembered next time.
// Wrapped in try/catch because some private browsers block storage.
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('fg.theme', theme); } catch { /* ignore */ }
}
function currentTheme() {
  try {
    const saved = localStorage.getItem('fg.theme');
    if (saved) return saved;
  } catch { /* ignore */ }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
applyTheme(currentTheme());
document.getElementById('theme-btn').addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

// ---------- Milestone (a): connection check ----------
// One row per check, with a status dot that turns green when it passes.
function checkRow(label) {
  const status = el('span', { class: 'check-status' }, 'checking…');
  const row = el('li', { class: 'check' }, el('span', { class: 'dot' }), el('span', {}, label), status);
  return {
    row,
    pass(text = 'OK') { row.classList.add('ok'); status.textContent = text; },
    fail(text) { row.classList.add('bad'); status.textContent = text; },
  };
}

async function runConnectionCheck() {
  const configRow = checkRow('Firebase config');
  const authRow = checkRow('Anonymous sign-in');
  const liveRow = checkRow('Live connection');
  const writeRow = checkRow('Database write + read');

  mount(app,
    el('section', { class: 'card hero' },
      el('h1', {}, APP_NAME),
      el('p', { class: 'muted' }, APP_TAGLINE)),
    el('section', { class: 'card' },
      el('h2', {}, 'Setup check'),
      el('ul', { class: 'checks' }, configRow.row, authRow.row, liveRow.row, writeRow.row)),
  );

  // Load firebase.js only now, so a missing config shows a clear message
  // instead of a crash.
  const emulatorRequested = new URLSearchParams(location.search).get('emulator') === '1';
  if (!isFirebaseConfigured() && !emulatorRequested) {
    configRow.fail('not set: paste your config into js/config.js');
    return;
  }
  const fb = await import('./firebase.js');
  const { ref, set, get, serverTimestamp } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js');
  configRow.pass(fb.usingEmulator ? 'using local emulator' : 'OK');

  try {
    const uid = await fb.signIn();
    authRow.pass(`OK (you are ${uid.slice(0, 6)}…)`);

    fb.onConnectionChange((online) => {
      if (online) { liveRow.row.classList.remove('bad'); liveRow.pass('online'); }
      else { liveRow.row.classList.remove('ok'); liveRow.fail('offline'); }
    });

    // Write the server time to connectionTest/<uid>, then read it back.
    const testRef = ref(fb.db, `connectionTest/${uid}`);
    await set(testRef, serverTimestamp());
    const snap = await get(testRef);
    const drift = Math.round((fb.serverNow() - snap.val()) / 1000);
    writeRow.pass(`OK (server time check: ${Math.abs(drift)}s)`);
    toast('Firebase is working 🎉');
  } catch (err) {
    console.error(err);
    const failing = authRow.row.classList.contains('ok') ? writeRow : authRow;
    failing.fail(friendlyError(err));
  }
}

// Turn Firebase error codes into advice a human can act on.
function friendlyError(err) {
  const code = err && err.code ? err.code : String(err);
  if (code.includes('operation-not-allowed') || code.includes('admin-restricted')) {
    return 'Anonymous sign-in is not enabled in Firebase (README step 3)';
  }
  if (code.includes('unauthorized-domain')) {
    return 'This website is not in Firebase "Authorized domains" (README step 6)';
  }
  if (code.includes('PERMISSION_DENIED') || code.includes('permission')) {
    return 'Blocked by database rules: publish firebase/database.rules.json (README step 5)';
  }
  if (code.includes('api-key')) return 'The apiKey in js/config.js looks wrong';
  return code;
}

runConnectionCheck();
