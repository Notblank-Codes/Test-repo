// =============================================================
// app.js — the starting point of the app (index.html loads it).
//
// It decides which screen to show:
//   ?check=1        -> the setup check (check.js)
//   in a room       -> the lobby (lobby.js)
//   otherwise       -> the home screen (home.js)
// and it handles rejoining your room after a page refresh.
// =============================================================

import { APP_NAME, isFirebaseConfigured } from './config.js';
import { el, mount, toast, showModal } from './ui.js';
import { load, save } from './storage.js';

const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
document.title = APP_NAME;
document.getElementById('brand-name').textContent = APP_NAME;

// ---------- Light / dark mode ----------
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  save('theme', theme);
}
applyTheme(load('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
document.getElementById('theme-btn').addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

// ---------- Address bar helpers ----------
// We keep ?room=ABCDE in the address while you are in a room, so a
// refresh brings you straight back, and the link can be copied.
function setRoomInUrl(code) {
  const url = code ? `${location.pathname}?room=${code}` : location.pathname;
  history.replaceState(null, '', url);
}

// ---------- Start ----------
let homeModule;   // home.js, loaded in start()
let lobbyModule;  // lobby.js, loaded in start()

async function start() {
  if (params.has('check') || !isFirebaseConfigured()) {
    const { runConnectionCheck } = await import('./check.js');
    return runConnectionCheck(app);
  }

  // Load the Firebase-dependent modules only after the config check.
  // They are small, so we load them all at once, in parallel.
  const [{ signIn }, room] = await Promise.all([import('./firebase.js'), import('./room.js')]);
  [homeModule, lobbyModule] = await Promise.all([import('./home.js'), import('./lobby.js')]);

  let uid;
  try {
    uid = await signIn();
  } catch (err) {
    console.error(err);
    mount(app, el('section', { class: 'card' },
      el('h2', {}, "Can't connect 😕"),
      el('p', {}, 'Check your internet connection and refresh the page.'),
      el('a', { class: 'btn secondary', href: './?check=1' }, 'Run setup check')));
    return;
  }

  // Which room should we be in? A ?room= link wins; otherwise the room
  // saved from last time (for when the address was lost).
  const invited = room.normalizeCode(params.get('room'));
  const lastRoom = load('lastRoom');
  const candidate = room.isValidCode(invited) ? invited : lastRoom;

  if (candidate && await room.stillInRoom(candidate)) {
    // Rejoin silently: we never left this room (we just refreshed).
    return enterRoom(candidate, uid, room);
  }
  save('lastRoom', null);
  showHome(room.isValidCode(invited) ? invited : '', uid, room);
}

function showHome(invitedCode, uid, room) {
  setRoomInUrl(invitedCode || null);
  const { renderHome } = homeModule;
  renderHome(app, {
    invitedCode,
    onCreate: async (profile) => enterRoom(await room.createRoom(profile), uid, room),
    onJoin: async (code, profile) => enterRoom(await room.joinRoom(code, profile), uid, room),
  });
}

function enterRoom(code, uid, room) {
  save('lastRoom', code);
  setRoomInUrl(code);
  mount(app, el('p', { class: 'muted center' }, `Joining room ${code}…`));

  const session = new room.RoomSession(code, uid, {
    onUpdate: () => lobbyModule.renderLobby(app, session, { onLeave: () => leave() }),
    onRemoved: (reason) => {
      save('lastRoom', null);
      showHome('', uid, room);
      showModal({ title: 'Back to home', body: [el('p', {}, reason)] });
    },
  });

  async function leave() {
    await session.leave();
    save('lastRoom', null);
    showHome('', uid, room);
    toast('You left the room');
  }

  session.start();
}

start();
