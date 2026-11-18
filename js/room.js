// =============================================================
// room.js — everything about rooms in the database.
//
//   createRoom()  makes a new room with a 5-letter code, you as host.
//   joinRoom()    adds you to an existing room (or rejoins after refresh).
//   RoomSession   keeps you connected to one room: live updates,
//                 online/offline presence, ready status, kicking,
//                 leaving, and automatic host promotion.
//
// How a room is stored in Firebase:
//   rooms/ABCDE/meta            { hostUid, createdAt, status, gameId, settings }
//   rooms/ABCDE/players/<uid>   { name, avatar, joinedAt, ready, online, lastSeen }
//   rooms/ABCDE/kicked/<uid>    true   (kicked players can't come back)
// =============================================================

import {
  db, signIn, ref, get, set, update, remove, onValue, onDisconnect, serverTimestamp,
} from './firebase.js';

export const MAX_PLAYERS_PER_ROOM = 16;

// No I or O, so codes can't be confused with 1 and 0 when read aloud.
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

// How long the host may be offline before someone else takes over.
// Long enough that a host who just refreshes the page keeps the role.
const HOST_GRACE_MS = 6000;

/** Friendly error the screens can show directly. */
export class RoomError extends Error {}

export function normalizeCode(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
}
export function isValidCode(code) {
  return /^[A-Z]{5}$/.test(code);
}

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return Array.from(bytes, (b) => CODE_LETTERS[b % CODE_LETTERS.length]).join('');
}

/** The link friends open to join this room, e.g. .../Test-repo/?room=ABCDE */
export function roomLink(code) {
  return `${location.origin}${location.pathname}?room=${code}`;
}

/** Create a room and return its code. */
export async function createRoom(profile) {
  const uid = await signIn();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const metaSnap = await get(ref(db, `rooms/${code}/meta`));
    if (metaSnap.exists()) continue; // code taken, try another

    // One multi-path update writes the room and our player entry together:
    // either both succeed or neither does.
    await update(ref(db), {
      [`rooms/${code}/meta`]: {
        hostUid: uid,
        createdAt: serverTimestamp(),
        status: 'lobby',
      },
      [`rooms/${code}/players/${uid}`]: newPlayer(profile),
    });
    return code;
  }
  throw new RoomError('Could not find a free room code. Please try again.');
}

function newPlayer(profile) {
  return {
    name: profile.name,
    avatar: profile.avatar,
    joinedAt: serverTimestamp(),
    ready: false,
    online: true,
  };
}

/**
 * Join a room by code. If you were already in it (for example you
 * refreshed the page), you simply rejoin with your old spot and score.
 */
export async function joinRoom(code, profile) {
  const uid = await signIn();
  if (!isValidCode(code)) throw new RoomError('Room codes are 5 letters.');

  const metaSnap = await get(ref(db, `rooms/${code}/meta`));
  if (!metaSnap.exists()) throw new RoomError(`Room ${code} doesn't exist. Check the code?`);

  const kickedSnap = await get(ref(db, `rooms/${code}/kicked/${uid}`));
  if (kickedSnap.exists()) throw new RoomError('The host removed you from this room.');

  const meRef = ref(db, `rooms/${code}/players/${uid}`);
  // We can only read the player list once we are a member, so we try to
  // read our own entry: if it exists, we are rejoining.
  const mine = await get(meRef);
  if (mine.exists()) {
    await update(meRef, { name: profile.name, avatar: profile.avatar, online: true });
    return code;
  }

  await set(meRef, newPlayer(profile));

  // Now that we are a member we can count players. If the room is over
  // the limit and we are one of the newest, step back out.
  const playersSnap = await get(ref(db, `rooms/${code}/players`));
  const players = Object.entries(playersSnap.val() || {})
    .sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
  const myPosition = players.findIndex(([id]) => id === uid);
  if (myPosition >= MAX_PLAYERS_PER_ROOM) {
    await remove(meRef);
    throw new RoomError(`Room ${code} is full (${MAX_PLAYERS_PER_ROOM} players max).`);
  }
  return code;
}

/**
 * Am I still a member of this room? Used to rejoin after a refresh.
 * Returns false (instead of throwing) when the room is gone.
 */
export async function stillInRoom(code) {
  const uid = await signIn();
  try {
    const snap = await get(ref(db, `rooms/${code}/players/${uid}`));
    return snap.exists();
  } catch {
    return false;
  }
}

/**
 * A live connection to one room.
 *
 *   const session = new RoomSession(code, uid, {
 *     onUpdate(room) { ...redraw the screen... },
 *     onRemoved(reason) { ...go back home... },
 *   });
 *   session.start();
 */
export class RoomSession {
  constructor(code, uid, { onUpdate, onRemoved }) {
    this.code = code;
    this.uid = uid;
    this.onUpdate = onUpdate;
    this.onRemoved = onRemoved;
    this.room = null;           // latest { meta, players, kicked }
    this.unsubscribers = [];
    this.hostTimer = null;
    this.left = false;
  }

  path(sub = '') { return `rooms/${this.code}${sub ? `/${sub}` : ''}`; }
  get meRef() { return ref(db, this.path(`players/${this.uid}`)); }
  get isHost() { return this.room?.meta?.hostUid === this.uid; }

  start() {
    // 1) Presence: whenever our connection comes (back) up, mark us online
    //    and tell Firebase to mark us offline if the connection drops.
    const stopPresence = onValue(ref(db, '.info/connected'), async (snap) => {
      if (snap.val() !== true || this.left) return;
      try {
        await onDisconnect(this.meRef).update({ online: false, lastSeen: serverTimestamp() });
        await update(this.meRef, { online: true });
      } catch { /* removed from room; the room listener handles it */ }
    });
    this.unsubscribers.push(stopPresence);

    // 2) Listen to the whole room and redraw on every change.
    const stopRoom = onValue(ref(db, this.path()), (snap) => {
      const room = snap.val();
      if (!room || !room.meta) return this.handleRemoved('This room has closed.');
      if (!room.players || !room.players[this.uid]) {
        return this.handleRemoved(
          room.kicked && room.kicked[this.uid] ? 'The host removed you from the room.' : 'You left the room.',
        );
      }
      room.players = room.players || {};
      this.room = room;
      this.checkHost();
      this.onUpdate(room);
    }, async () => {
      // Permission denied = we are no longer a member. Find out why.
      let kicked = false;
      try { kicked = (await get(ref(db, this.path(`kicked/${this.uid}`)))).exists(); } catch { /* room gone */ }
      this.handleRemoved(kicked ? 'The host removed you from the room.' : 'You are no longer in this room.');
    });
    this.unsubscribers.push(stopRoom);
  }

  /** Players sorted by when they joined, as [{ uid, ...data }]. */
  playerList() {
    return Object.entries(this.room?.players || {})
      .map(([uid, p]) => ({ uid, ...p }))
      .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
  }

  // ---------- Host promotion ----------
  // There is no server to pick a new host, so every phone runs the same
  // rule: "if the host has been offline for a few seconds, the
  // longest-waiting online human becomes host". Only that one phone
  // acts, and the database rules double-check it is allowed.
  checkHost() {
    const { meta, players } = this.room;
    const host = players[meta.hostUid];
    const hostAway = !host || host.online === false;
    if (!hostAway) {
      clearTimeout(this.hostTimer);
      this.hostTimer = null;
      return;
    }
    const nextHost = this.playerList().find((p) => p.online !== false && !p.isBot);
    if (!nextHost || nextHost.uid !== this.uid || this.hostTimer) return;

    const wait = host ? HOST_GRACE_MS : 0; // host left on purpose: take over now
    this.hostTimer = setTimeout(async () => {
      this.hostTimer = null;
      if (this.left || !this.room) return;
      const current = this.room.players[this.room.meta.hostUid];
      if (current && current.online !== false) return; // host came back
      try {
        await set(ref(db, this.path('meta/hostUid')), this.uid);
      } catch (err) {
        console.warn('Host takeover refused', err);
      }
    }, wait);
  }

  // ---------- Actions ----------
  setReady(ready) {
    return update(this.meRef, { ready: Boolean(ready) });
  }

  /** Host only: remove a player and stop them rejoining. */
  async kick(uid) {
    if (!this.isHost || uid === this.uid) return;
    await update(ref(db, this.path()), {
      [`kicked/${uid}`]: true,
      [`players/${uid}`]: null,
    });
  }

  /** Leave the room for good. If we are host, hand it to the next player first. */
  async leave() {
    this.left = true;
    try {
      if (this.isHost) {
        const next = this.playerList().find((p) => p.uid !== this.uid && p.online !== false && !p.isBot);
        if (next) await set(ref(db, this.path('meta/hostUid')), next.uid);
      }
      await onDisconnect(this.meRef).cancel();
      await remove(this.meRef);
    } catch (err) {
      console.warn('Leave failed', err);
    }
    this.stop();
  }

  handleRemoved(reason) {
    if (this.left) return;
    this.left = true;
    this.stop();
    this.onRemoved(reason);
  }

  stop() {
    clearTimeout(this.hostTimer);
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
  }
}
