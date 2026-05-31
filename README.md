# Белот онлайн · Le Salon de Belot

A real-time, browser-based Bulgarian Belot game for four players. Built with a strict
**authoritative-server / pure-engine** architecture so the rules cannot be cheated
client-side, the game state is fully deterministic, and every play is unit-tested.

Live deployment: a static frontend on Netlify talks to a Fastify + Socket.IO server on Render.

---

## Highlights

- **Full Bulgarian Belot ruleset** per the canonical reference at
  [belot.bg/belot/rules](https://belot.bg/belot/rules/) — bidding (♣♦♥♠/NT/AT),
  contra/re-contra, capot, terca/kvarta/quinta, carrés, belot (K+Q of trump),
  suspended-hand carry, divide-by-10 scoreboard.
- **Authoritative server.** The client only renders state and sends intents.
  The server validates every action against a pure rules engine and emits one
  `PlayerView` per seat with hidden hands masked — no card leaks over the wire.
- **102 engine unit tests** covering rankings, bidding, legal moves, announcements
  (including the *card-can-only-count-once* rule and the All Trumps trick-winner
  edge case), scoring (including suspended-hand carry, capot, contra/recontra),
  and full deterministic hand replays from fixed seeds.
- **Salon aesthetic.** EB Garamond display type, antique-cream cards with engraved
  pip layouts, brass plates, deep racing-green felt, framer-motion animations for
  the deal, the trick fan, and the trick-collection slide.
- **Bots that actually play.** A handcrafted bidding heuristic evaluates each
  contract against the seat's 5-card hand, with a tunable randomness wobble so
  bot games feel varied; gameplay falls back to lowest-value legal card.
- **Bulgarian + English UI** with full locale switching and Cyrillic-aware
  typography. All copy reviewed for grammar and definite articles.
- **Mobile-responsive.** Three opponent badges stack at the top on phones with the
  felt centered below; card and felt dimensions scale across three breakpoints.

---

## Repository layout

A pnpm-style monorepo with npm workspaces.

```
packages/
  shared/   types + zod schemas shared by client/server
  engine/   pure TS rules + state machine, no IO, fully unit-tested
  server/   Fastify + Socket.IO authoritative game host (in-memory rooms)
  client/   React + Vite + Tailwind + framer-motion + Zustand
infra/      (optional) deployment configs
Dockerfile  multi-stage build → 47 KB ESM server bundle
render.yaml backend deploy spec
netlify.toml frontend deploy spec
CLAUDE.md   authoritative rules reference + conventions
```

### The engine (`packages/engine`)

Pure, deterministic TypeScript. No `Date.now()`, no IO, no random outside `rng.ts`
(`mulberry32(seed)`). Every state transition is a function `apply(state, action) →
state | error`. Tests are scenario-driven: "AT, bidder wins capot, no contra → bidder
gets X tens" — not implementation tests. This lets us refactor the engine without
breaking the scoring contract.

Key modules:

| File | Concern |
|------|---------|
| `deck.ts` | Build deck, shuffle, deal 5+3 |
| `ranking.ts` | Card values, strength, sort-for-display |
| `bidding.ts` | Bid legality, 3-pass termination, 4-pass redeal, contra/re-contra |
| `legalMoves.ts` | Must-follow-suit, over-trump, partner-winning exception, AT-specific same-suit rule |
| `announcements.ts` | Sequence + carré detection, dedup of shared cards, tie-break |
| `scoring.ts` | Made/inside/suspended outcomes, capot, multipliers, tens conversion |
| `match.ts` | Top-level reducer, snapshot ↔ projection, hand-history log |

### The server (`packages/server`)

A single Fastify process with one Socket.IO namespace per room. Rooms are kept in
memory; no Postgres or Redis required for the MVP. The server is the source of
truth for legality, timers, and bot moves. After every accepted action it broadcasts
a per-seat `PlayerView` over WebSocket — the only state the client ever sees.

Notable server behaviours:

- **Completed-trick linger:** when the 4th card lands, the server holds the trick
  on the table for 1.5 s so humans can see who played what before the cards are
  collected with an animated slide toward the winner.
- **Bot pacing:** bot moves are scheduled with a 750 ms delay so they don't feel
  instantaneous.
- **Empty-room cleanup:** when every socket disconnects, the room is deleted
  after 60 s. Reconnect within the grace window resumes the same seat.
- **Anti-cheat:** the server never broadcasts the full `GameSnapshot`. Each seat
  receives a `PlayerView` with `yourHand` for them and only `handCounts` for the
  other three.

### The client (`packages/client`)

React 18 + Vite + Tailwind + Zustand for the small amount of client state. Game
state lives entirely in the `view` from the server; the client never speculates
about cards it hasn't been shown.

Pages:

- `/` — landing (nickname + create/join room)
- `/r/:code` — room flow: join form → lobby → table (one route, three states)

UI features:

- Sorted hand: trump suit first (if a trump contract), high-to-low within each suit
- Live bid chips above each seat during bidding
- Discreet pinned announcements card on the felt edge
- Score-plate header opens a per-hand history modal (contract, bidder, raw and
  tens-rounded points, announcements per hand)
- Hand-result breakdown banner appears after each hand for 6 seconds
- "You hold" cream-paper hint listing the player's potential combinations before
  trick 1 freezes the announcement-resolution

---

## Quick start (local development)

Requires **Node 20+**. The repo uses npm workspaces.

```bash
git clone <this-repo>
cd belot
npm install
```

In one terminal:
```bash
cd packages/server
npm run dev      # Fastify + Socket.IO on http://localhost:3001
```

In another:
```bash
cd packages/client
npm run dev      # Vite on http://localhost:5173
```

Open <http://localhost:5173> in four browser tabs (or use Chrome + Incognito + Firefox
+ Edge for four independent localStorages). The host creates a room, the others
paste the URL.

### Tests

```bash
cd packages/engine
npm test                # 102 unit tests
npm run test:coverage   # with v8 coverage report
```

The engine tests run in well under a second. Run them in watch mode while iterating
on rules:

```bash
npx vitest
```

---

## Deploy

**Frontend → Netlify · Backend → Render**

The server runs on Render's **Starter** plan ($7/mo) so it stays always-on — no
sleep, no ~30 s cold start. (The Free plan works but sleeps after 15 min of
inactivity, which is a broken first impression for new players.)

### Backend on Render

1. Push the repo to GitHub.
2. <https://render.com> → **New** → **Web Service** → connect the repo.
3. Render reads `render.yaml`. Confirm: runtime = **Docker**, plan = **Starter**.
4. Set the backend environment variables (Render dashboard → service →
   **Environment**) — these are `sync: false` in `render.yaml`, so values live
   only in the dashboard:
   - `CORS_ORIGIN` = your Netlify URL (see CORS below)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` —
     **required**; without them the server runs guest-only and records no
     matches (no leaderboard, no tournament results).
5. Wait for the build (~3–5 min). The service URL looks like
   `https://belot-<random>.onrender.com`.
6. Open `<that-url>/health` — you should see `{"ok":true,"rooms":0}`.

### Frontend on Netlify

1. <https://app.netlify.com> → **Add new site** → **Import an existing project** →
   GitHub → pick the repo.
2. Netlify reads `netlify.toml`. Confirm base / build / publish settings.
3. **Site configuration → Environment variables** → add
   `VITE_SERVER_URL = https://<your-server>.onrender.com` (no trailing slash).
4. **Deploys tab → Clear cache and deploy site** so the env var is baked into the
   new bundle.

### CORS

Back on Render → your service → **Environment** → set
`CORS_ORIGIN = https://<your-site>.netlify.app` (no trailing slash). The server
restarts in ~30 s and the lobby will reach it.

---

## Game rules (canonical reference)

The authoritative summary of every rule the engine enforces lives in
[`CLAUDE.md`](./CLAUDE.md). Quick overview:

- 32 cards (7–A), 4 seats, partners opposite. NS = seats (0, 2). EW = seats (1, 3).
- Two-round deal: **5 cards** to each player → bidding → **3 more** to each.
- Bidding (ascending): PASS < ♣ < ♦ < ♥ < ♠ < NT < AT. Contra by opponents doubles
  the final result; re-contra by the bidding team quadruples. Three consecutive
  passes after a bid → that bid wins. Four passes on the first round → redeal by
  the next dealer.
- Trump suit: J=20, 9=14, A=11, 10=10, K=4, Q=3 (J > 9 > A > 10 > K > Q > 8 > 7).
- Non-trump: A=11, 10=10, K=4, Q=3, J=2 (A > 10 > K > Q > J > 9 > 8 > 7).
- **All Trumps:** every suit uses trump values, but no suit dominates another —
  only cards of the led suit can win the trick.
- **No Trumps:** plain values, totals doubled at scoring, **no announcements**
  except the +10 last-trick and +90 capot bonuses.
- Announcements (suit + AT only): terca +20, kvarta +50, quinta +100, carré 100
  (10/Q/K/A) / 150 (9s) / 200 (Jacks). A single card cannot count toward two
  announcements — the engine takes the carré (higher value) and re-evaluates
  the sequence on the remaining cards.
- Belot (K + Q of trump in the same hand) = +20 when the second of the pair is
  played by the same seat.
- Made / Inside / Suspended:
  - Bidder > defender → each team records its own points
  - Bidder < defender → defenders take everything (cards + announcements +
    capot; belot stays with the holder)
  - Bidder == defender → suspended; bidder's points hang for the next hand winner
- Scoreboard counts in **tens** (raw card pool / 10, half-up rounded).
- First to **151 tens** wins; if both teams cross at the same hand, the higher
  team wins; if tied at ≥151, play continues.

### Optional house rule

A single host-toggle in the lobby controls **Capot × contra**:

- On (default): the +90 capot bonus is multiplied by contra/re-contra alongside
  card points and announcements.
- Off: the capot bonus stays fixed at 90 regardless of contra/re-contra (tournament
  variant).

---

## Bots

Bots have two simple but real strategies:

- **Bidding:** evaluate each available contract by summing the value of the bot's
  5-card hand if that contract were trump, plus a length bonus for 4+ trump cards.
  Bid if the score crosses a threshold (40 for suits, 54 for NT, 58 for AT) plus a
  small deterministic wobble seeded from `(handSeed, seat)` so the same hand
  doesn't always bid the same way. Raise an existing bid only with a higher margin.
  Contra when defending a strong-looking opponent bid with 2+ Jacks + 2+ honour
  cards.
- **Play:** lowest-value legal card. Same fallback the turn-timer uses if a human
  doesn't act in 30 seconds.

This is enough to make a 1-human + 3-bot game playable; it isn't a perfect MCTS
player. Bot pacing is intentionally 750 ms per move so the table feels populated
without being chaotic.

---

## Anti-cheat

The single most important invariant: the server never broadcasts the full snapshot.
Each socket receives only its seat's `PlayerView`, which contains:

- `yourHand` — the player's own cards
- `handCounts[seat]` — counts only for the other three seats
- Public state: bid history, current/last trick, contract, trump, scoreboard,
  announcements, hand history

This is enforced in `engine/match.ts → projectView` and the server's
`broadcastViews` only ever sends that projection. A regression here is the kind
of thing the engine test suite is designed to catch — `match.spec.ts` asserts that
no two seats' projected hands ever overlap.

---

## Out of scope

These were deferred from the MVP and live in the project plan rather than the
code:

- Postgres / Redis persistence (rooms are in-memory; a server restart loses them)
- Auth beyond guest play (a per-browser playerId in localStorage paired with
  nickname is enough for friends games)
- ELO / match history aggregation
- Replay UI from event logs
- The "С капо не се излиза" tournament variant
- Native mobile apps

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Language | TypeScript everywhere |
| Engine | Pure functions, Vitest, no deps |
| Server | Fastify 4 + Socket.IO 4 + zod, bundled with tsup |
| Client | React 18 + Vite 5 + TailwindCSS 3 + Zustand 4 + framer-motion 11 + react-router 6 |
| i18n | Custom Zustand store + typed message keys (BG + EN, Cyrillic) |
| Type fonts | EB Garamond (display, italic), Plus Jakarta Sans (body), JetBrains Mono (codes & scores) |
| Hosting | Netlify (static) + Render Web Service (Docker) |

---

## References

- Bulgarian Belot rules: <https://belot.bg/belot/rules/> (Casualino JSC)
- Project conventions and authoritative rules summary: [`CLAUDE.md`](./CLAUDE.md)
