# FlashGames progress

This file is the hand-over note. Anyone (or any new Claude session) picking up the work should read it first.

## Working rules

- Build one milestone at a time. After each one: commit, then stop and give exact two-tab / two-phone test steps.
- Manual steps (Firebase console, GitHub settings) get exact step-by-step instructions, then wait for the owner.
- Whot and Ayo: list the planned rules and get the owner's confirmation before coding.
- No drawing games. No song lyrics. No secrets in the repo.
- User text is only ever displayed with `textContent`.

## Milestones

- [x] **(a) Project setup and Firebase connection.** Static page, theme, Firebase SDK from CDN, anonymous sign-in, live connection check, server time, emulator support, setup check screen.
- [ ] **(b) Home, rooms and lobby.** Nickname + emoji avatar, create/join with 5-letter code, `?room=` links, WhatsApp share, live player list, ready status, kick, host promotion, rejoin after refresh.
- [ ] **(c) Plugin system.** `games/registry.js`, game interface, game picker with categories, host-referee engine, shared timer, scoreboard, winner screen, play again, sound toggle, how-to-play popup.
- [ ] **(d) Game 1: Naija Herd Mentality.** 60+ questions in JSON, answer normalising and fuzzy matching.
- [ ] **(e) Solo mode and bots.**
- [ ] **(f) Security rules and cleanup.** Full rules, room-creation rate limit, inactive room deletion, profanity filter.
- [ ] **(g) PWA and polish.** Manifest, service worker under a subpath, PNG icons.
- [ ] **(h) Deploy to GitHub Pages.** README deploy + redeploy steps, live link.
- [ ] **(i) Remaining games**, 2 or 3 at a time (see list below).

## Game list (in order)

1. Naija Herd Mentality
2. Most Likely To
3. Guess the Emoji (no song lyrics)
4. Imposter
5. Name, Place, Animal, Thing
6. Typing Race
7. Who Said It?
8. Bluff
9. Word Chain
10. Hangman, Would You Rather, Trivia Battle, Speed Math Race, Category Rush
11. Tic-Tac-Toe, Connect 4
12. Whot (confirm rules first)
13. Ludo
14. Ayo (confirm rules first)

## Notes for whoever continues

- Repo: `Notblank-Codes/Test-repo`, work happens on branch `flashgames`.
- Live site will be `https://notblank-codes.github.io/Test-repo/`.
- Firebase SDK version is pinned in `js/firebase.js` (10.12.2). Change all three import URLs together.
- Local emulator: `firebase emulators:start --project demo-flashgames`, then open `http://localhost:8000/?emulator=1`.
