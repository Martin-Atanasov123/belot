# CLAUDE.md — Belot Online Master Operating System
# Version 2.0 — Game Truth + Brand + Design + UX + Growth + Retention + Monetization

You are not building a generic card game. You are building **the most atmospheric, trustworthy,
and respectful Bulgarian belot platform that has ever existed in a browser** — a salon-quality
table for a game that millions of Bulgarians grew up with around real wooden tables, in real cafés,
with real people they loved.

Every line of code, every word of copy, every animation, every visual detail must serve one purpose:
**make a Bulgarian belot player feel that the table is real, the rules are right, and the company
across the felt — be it friends, strangers, or bots — is worth their evening.**

Read this file completely before writing a single line of code. Then execute without shortcuts.
Whenever a game-logic question arises, this file wins over memory. Whenever a brand or UX question
arises, this file wins over generic design intuition.

---

## 0. GLOBAL NON-NEGOTIABLE RULES

### Rule 0.1 — Engine is pure and deterministic
The `@belot/engine` package has **no `Date.now()`, no IO, no globals, no randomness outside `rng.ts`**.
Pass a seed in → get the same state back, always. This is what makes unit tests fast, replays
bit-exact, and bug reports reproducible. Never reach for `Math.random()` inside the engine.
Never import anything network-, fs-, or time-related into engine code.

### Rule 0.2 — Server is authoritative; the client never decides anything that matters
The client renders state and sends intents. The server validates → applies via the engine →
projects per seat → broadcasts. Never trust the client about legality, scoring, announcements,
seat ownership, room membership, or match results. If you see logic that would let a hostile
client lie about the game, that is a security bug — fix it before anything else.

### Rule 0.3 — Anti-cheat: no full snapshots leave the server
For each seat we project a `PlayerView` that hides the other three hands (only counts are shown).
**Never broadcast the full `GameSnapshot`** to anyone, including spectators (spectators get a
public projection with all hidden hands stripped). Never log full snapshots to any sink a user
could see.

### Rule 0.4 — Match results are written ONLY by the server
The browser cannot insert into `public.matches` or set `tournament_matches.winner_id` —
those write paths are revoked by RLS and a DB trigger. The server writes via the **service-role
key** on game-over (`maybePersistMatch` in `packages/server/src/index.ts`). If you ever consider
adding a client-side write to those tables, you are reintroducing SEC-001/SEC-002.

### Rule 0.5 — i18n source of truth is `bg.ts`
Client UI strings live in `packages/client/src/i18n/{bg,en}.ts`. The `MessageKey` union is derived
from `bg.ts`; `en.ts` must satisfy `Record<MessageKey, string>`. Any new UI string goes into both
files; no orphan keys, no missing translations, no hard-coded Bulgarian text in components.
Server-side error strings stay English (they are internal error codes, not user-facing copy).

### Rule 0.6 — No emojis in code, comments, or commit messages
Unless the user explicitly asks. Emojis age badly, break monospaced layouts, and don't fit the
salon brand.

### Rule 0.7 — Tests describe scenarios, not implementations
A scoring test reads: *"AT, bidder wins capot, no contra → bidder gets X tens."*
Not: *"scoreHand returns 252 when given input { ... }."*
Tests are documentation; they should survive refactors of the math.

### Rule 0.8 — Commits are atomic and follow Conventional Commits
`feat(scope):`, `fix(scope):`, `chore:`, `refactor:`, `docs:`. One logical change per commit.
The post-commit hook auto-pushes `main` → Render (server) and Netlify (client) auto-deploy.
Therefore: **the working tree on `main` is always deployable**. Never commit broken builds.

---

## 1. CORE PRODUCT UNDERSTANDING

### What Belot Online Actually Is
A free, real-time, browser-based Bulgarian belot platform that lets four people play a real,
rules-correct game in under sixty seconds — alone with bots, with three strangers via matchmaking,
or with friends via a shared room code. No installs, no ads, no fake "premium" mechanics that
warp the gameplay. The rules are the rules from `belot.bg` (Casualino JSC), implemented exactly.

It is **not** a casino-style cards-themed slot machine. It is **not** belot.bg's cluttered
ad-funded UI. It is **not** a half-built side project. It is a salon — quiet, certain,
well-lit — where the cards behave the way Bulgarian belot has always behaved.

### Who It Serves (Know This Player Deeply)

**Primary — the lifetime player (35–70 years old)**
- Grew up with belot at the kitchen table, in the army, at university, at the village café.
- Knows the rules cold — every wrong contra, missed belot, or bad announcement scoring will be
  noticed and will lose your trust forever.
- Plays on a phone in the evening, on a desktop at lunch, sometimes on a tablet in bed.
- Has limited patience for laggy UIs, surprise paywalls, and "Sign up to play" walls.
- Came to a browser game because Vibox, Casualino, and the rest feel like ad-soaked casinos.

**Secondary — the friend group (25–45 years old)**
- Four friends who want to keep playing together after they no longer live in the same city.
- Use a shared link in Viber / WhatsApp / Messenger to meet at the same table.
- Don't want to "find a game" — they want their own private room, fast.
- They are why the **Частна стая** path exists and why "share the code" must be one tap.

**Tertiary — the solo evening player (any age)**
- Has 20 minutes, wants a hand or two of belot against bots that don't cheat and don't stall.
- Came in via search, social, or word of mouth.
- They are why **Бързо намиране** exists and why the lobby must never feel dead.

### The Real Pain Points (Emotional, Not Functional)
1. **"Every belot site looks like a casino."** Flashing ads, fake chips, scammy-feeling "VIP"
   prompts. Players who love belot are insulted by this aesthetic.
2. **"The rules are wrong."** Other implementations get belot/contra/capot/announcement scoring
   subtly wrong. A lifetime player notices immediately and never comes back.
3. **"The table is empty."** Browse-based lobbies with no active rooms make the site feel dead
   at exactly the worst moment — first impression. *(See §15: this is why we don't show a public
   room list and prefer matchmaking + private codes.)*
4. **"I just want to play with my friends."** Most platforms drown the friends-room flow under
   tournaments, ranked queues, and shop pop-ups. Friends should be the **first** action visible.
5. **"My win didn't count."** Trust is destroyed instantly when a finished match doesn't land in
   the leaderboard or history. Server-authoritative persistence (Rule 0.4) is not optional.
6. **"The bots are obvious cheaters."** Bots that always know the right card, or that play
   instantly with no delay, kill the illusion. *(See §6: bots play with humane timing and use
   only legal moves the engine sees.)*

### Emotional Drivers (Design for These, Not Features)
- **Belonging** — the table feels like one you've sat at before, not like a slot lobby.
- **Mastery** — the announcements scoring, the contra timing, the belot reveal all reward
  knowing the game. The interface must surface these moments, not bury them.
- **Calm** — the salon is quiet. The battlefield (during play) is even quieter — no decoration
  steals attention from the cards.
- **Camaraderie** — reactions, the spectator count, the partner's name on the felt — small
  signals that you're playing *with* people, not against a machine.

### Trust Signals That Matter Most (In Priority Order)
1. **Rules accuracy.** Belot, контра, реконтра, капо, висящ, NT doubling, all announcement
   tie-breaks — exactly per `belot.bg`. (§2 of this file is the source of truth.)
2. **Server-authoritative results.** Wins land in the database, in the history, in the leaderboard.
   No mystery losses.
3. **Beautiful, calm UI.** Atmospheric Minimalism (§7) — no ads, no neon, no slot-machine glow.
4. **Real-time without lag.** Card plays feel immediate; bots act in well-paced human time.
5. **Bulgarian native voice.** "ти" form, salon-flavored, no Google-Translate English residue.
6. **No paywall in front of basic gameplay.** Premium is for *more*, never for *access*.

---

## 2. GAME RULES — BULGARIAN BELOT (CANONICAL)

This section is the **source of truth** for game logic. Whenever the code disagrees with this
section, the code is wrong. Whenever this section disagrees with general intuition, this
section wins. Source: <https://belot.bg/belot/rules/> (Casualino JSC).

### 2.1 Cards
- 32-card deck (bridge deck with 2–6 removed): ranks `7 8 9 10 J Q K A`, suits `♣ ♦ ♥ ♠` (C/D/H/S).
- 4 players, two teams: **(0, 2) = NS** vs **(1, 3) = EW**. Partners sit opposite.
- Dealing direction: counter-clockwise. (Implementation uses `nextSeat = (s+1)%4` as the
  "next bidder" rotation; direction is convention only as long as partners stay opposite.)

### 2.2 Deal
- Deal happens in two rounds: **3 + 2** = 5 cards each.
- Bidding then opens.
- After bidding ends with a chosen contract, dealer deals the remaining **3** cards each →
  8 cards total per player.
- First bidder = player to the right of the dealer (`nextSeat(dealer)` in our model).

### 2.3 Bidding (Наддаване)

Bid order (ascending strength):
```
PASS < C (Спатия) < D (Каро) < H (Купа) < S (Пика) < NT (Без коз) < AT (Всичко коз)
```
- Each player in turn: **PASS**, **BID** (higher than current), **CONTRA**, or **RECONTRA**.
- Only the opposing team may **CONTRA** the current bid. CONTRA doubles all points (including
  premiums and capot) for the team that wins the hand.
- Only the bidding team may **RECONTRA**, and only if the opposing team contra'd. Quadruples all points.
- Bidding ends when **3 consecutive passes follow a bid** → that bid wins.
- **4 passes before any bid** → redeal by next dealer (next-seat).

### 2.4 Card values (cardPoints)
```
Trump suit:      J=20  9=14  A=11  10=10  K=4  Q=3  8=0  7=0
Non-trump suit:  A=11  10=10  K=4   Q=3   J=2  9=0  8=0  7=0
```

### 2.5 Card strength (cardStrength)
```
Trump:      J > 9 > A > 10 > K > Q > 8 > 7
Non-trump:  A > 10 > K > Q > J > 9 > 8 > 7
```
A trump card always beats any non-trump card.

### 2.6 Contracts
| Contract | Trump suit | Card values | Notes |
|---|---|---|---|
| C, D, H, S | named suit | trump for that suit, plain for others | standard "colour" contract |
| NT (Без коз) | none | every suit uses plain values | **no announcements allowed** (except last-10 and capot bonus). Final card points are **doubled** (the capot bonus is NOT doubled). |
| AT (Всичко коз) | every suit | every suit uses trump values | announcements allowed |

### 2.7 Play (Разиграване)
- Lead first trick: player to the right of the dealer.
- Each subsequent trick: led by previous trick's winner.
- Must follow suit if possible.
- In trump contracts (C/D/H/S, and AT where every suit is trump): if cannot follow suit,
  **must trump** if able. If a trump has already been played in this trick, **must over-trump**
  (надкозване) if possible — UNLESS your partner is currently winning the trick, in which case
  you may discard freely.
- In NT: never required to trump (there is no trump).
- 10-point bonus to the winner of the **last trick** (Последни 10).
- 90-point bonus for **capot** (all 8 tricks taken by one team).

### 2.8 Announcements (Анонси)
Declared by **playing your first card of the hand** (with or without the announcement card
on the table; the act of playing your first card "declares" any combos you hold).

| Combo | Bulgarian name | Points |
|---|---|---|
| 3 consecutive same-suit | Терца | 20 |
| 4 consecutive same-suit | Кварта | 50 |
| 5+ consecutive same-suit | Квинта | 100 |
| Four 10/Q/K/A | Каре | 100 |
| Four 9s | Каре от деветки | 150 |
| Four Jacks | Каре от валета | 200 |

Sequence rank order: `7 < 8 < 9 < 10 < J < Q < K < A` (NOT the strength order; the natural rank order).

Tie-breaking when comparing across teams:
1. **Carrés outrank sequences.** If both teams have a carré, the higher-points carré wins
   (J=200 > 9=150 > rest=100).
2. Among sequences: **longer wins**. Same length → **higher top rank** wins.
3. Still tied → **trump-suit announcement** wins.
4. Still tied → team that announced **first** wins (in our model = lowest seat number among
   declarers, since all simultaneously declare on trick 1).

**Only the winning team's announcements score.** The losing side's combos are forfeit.

**Белот** (K + Q of the trump suit, held by one player) = +20 to that player's team. Played by
playing both K and Q to the table; the bonus is awarded when the second of the pair is played
by the same seat. Not available in NT. **Scored once** — `scoreHand` skips any `kind:'belot'`
entry in the announcements list and awards belot only via `belotDeclaredBy` (see `scoring.ts`).

**No announcements at all in NT.** Source: belot.bg — *"При игра на „Без коз" играчите нямат
право да обявяват притежаваните от тях комбинации."*

If one card participates in both a карé and a sequence, the holder picks which combo to count.
**Engine canonical AI choice: take the carré** (carrés are always higher-value); the sequence is
then re-evaluated on the remaining cards (and dropped if it falls below 3 consecutive).
See `scanHand` in `announcements.ts`.

### 2.9 Hand scoring & "inside / suspended"
After the 8th trick:
1. Sum trick points + 10 for last trick = `cardPoints` per team.
2. Add announcement points (only the winning team's).
3. Add Белот (+20) to the holder's team if completed.
4. If one team won all 8 tricks → +90 capot to them.
5. Apply NT doubling to **card points and announcements** (capot is NOT doubled). Belot doubling
   varies — we keep it un-doubled in NT (NT has no belot anyway).
6. Compare `bidderTotal` vs `defenderTotal`:
   - `bidder > defender` → **изкарана** (made): each team records its own points.
   - `bidder < defender` → **вкарана** (inside): defenders take **all** card points + all
     announcements + the capot (if any). Bidders score 0 (belot, if held, stays with the declarer).
   - `bidder == defender` → **висяща** (suspended): bidders' points are held in a "hung pool" and
     added to whoever wins the next hand. Defenders record their own points normally. If the next
     hand is also suspended, the pool accumulates.
7. Apply multiplier (×2 for CONTRA, ×4 for RECONTRA) to the final awarded values, **including
   all premiums and capot**.
8. Convert raw points → match score: **divide by 10, round to nearest integer**. The match-score
   column counts in "tens".
   - Suit trump and AT: standard half-up rounding (≤4 down, ≥5 up).
   - NT: rounding happens AFTER doubling.
   - Edge cases documented but simplified in MVP:
     - AT with both teams ending in 4-or-higher last digit → the team with FEWER points rounds up.
     - Suspended-point rounding: 15-or-16 hang on AT; 10-or-11 hang on trump-suit. (Not yet
       implemented; current code adds suspended to the next-hand winner verbatim, then re-rounds.)

### 2.10 Match end
- First team to **151+ tens** wins.
- If both cross 151 in the **same** hand: the team with more wins.
- If equal at ≥151: keep playing until one is strictly ahead.
- **"С капо не се излиза"** (cannot win on a capot alone): if you cross 151 only because of a
  capot bonus, an extra hand is played (all-pass redeals don't count). **Not yet implemented in MVP.**
- **Capot × contra is configurable.** `RoomSettings.capotDoubledByContra` — default `true`
  (the +90 capot is multiplied by contra/re-contra). Set `false` for the tournament variant where
  the capot bonus stays fixed at 90 even under contra/re-contra. Host can toggle from the lobby
  before the game starts. See `scoreHand` in `scoring.ts`.

---

## 3. PROJECT SHAPE

Monorepo, npm workspaces.

```
packages/
  shared/   types + zod schemas shared across client/server
  engine/   pure TS rules + state machine, no IO, fully unit-tested
  server/   Fastify + Socket.IO authoritative game host
  client/   React + Vite + Tailwind + framer-motion
supabase/migrations/   ordered SQL — apply via Studio or MCP
.claude/   project-scoped agent skills (graphify) + PreToolUse hooks
```

Deploy targets:
- **Server**: Render (Starter plan, always-on, no cold start). Env: `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `CORS_ORIGIN`. Without the first three
  the server runs in guest mode and persists nothing — login still works (local JWT verify),
  but match writes silently fail. Diagnostic: `GET /debug/persist` returns
  `{ configured, canWrite }`.
- **Client**: Netlify. Env: `VITE_SERVER_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **DB / Auth**: Supabase. RLS is strict on `matches` and `tournament_matches`; the server uses
  the service-role key to write (bypasses RLS), nothing else can.

---

## 4. IMPLEMENTATION MAP

| Concern | Where |
|---|---|
| Card / Action / Snapshot types & schemas | `packages/shared/src/types.ts` |
| Deck build & deal | `packages/engine/src/deck.ts` |
| Trump vs plain values, strength | `packages/engine/src/ranking.ts` |
| Must-follow-suit / over-trump | `packages/engine/src/legalMoves.ts` |
| Bid validity, contra/recontra, 3-pass / 4-pass | `packages/engine/src/bidding.ts` |
| Sequences / carrés / belot detection & tie-break | `packages/engine/src/announcements.ts` |
| Hand scoring incl. inside/suspended/capot/multiplier | `packages/engine/src/scoring.ts` |
| Phase reducer (newMatch / apply / advanceHand) | `packages/engine/src/match.ts` |
| Per-seat PlayerView projection (anti-cheat) | `packages/engine/src/match.ts` → `projectView` |
| Authoritative server, rooms, sockets, bots | `packages/server/src/{index,room}.ts` |
| Service-role writes (matches, tournament winners) | `packages/server/src/supabase.ts` |
| Quick-match lobby + bot vote + fallback timer | `packages/server/src/index.ts` (`findOrCreateQuickRoom`, `fillBotsAndStart`, `room:voteBots`) |
| Client store (Socket.IO state + actions) | `packages/client/src/store/game.ts` |
| Lobby / waiting room (private + quick) | `packages/client/src/components/Lobby.tsx` |
| In-game HUD + bidding + play | `packages/client/src/components/Table.tsx`, `BiddingPanel.tsx` |
| Hub (Табло) — create/join/quick match | `packages/client/src/routes/Tablo.tsx` |
| Auth pages (login / signup / forgot / reset) | `packages/client/src/routes/AuthPages.tsx` |
| Settings (profile / game / notifications / account) | `packages/client/src/routes/Settings.tsx` |
| Turn notification (Web Notifications API) | `packages/client/src/lib/notify.ts` |
| Stats / leaderboard / profile reads | `packages/client/src/lib/stats.ts` |
| Tournaments (bracket data layer) | `packages/client/src/lib/tournaments.ts` |
| Match persistence schema + RLS | `supabase/migrations/20260518_init_auth_and_match_history.sql` |
| Tournament schema + propagation trigger | `supabase/migrations/20260518_phase_d_tournaments.sql` |
| Security hardening (revoke client writes) | `supabase/migrations/20260521_security_hardening.sql` |

---

## 5. CONVENTIONS

### 5.1 Engine purity (Rule 0.1 expanded)
Engine functions are total over their input types: given a `GameSnapshot` and an `Action`, return
either a new `GameSnapshot` or an `EngineError` — never throw, never log, never call out.
Randomness comes from a seeded RNG (`mulberry32`) injected into `newMatch({ seed, settings })`.
If you need a clock for a server-side feature, the **server** keeps the clock; the engine doesn't.

### 5.2 Reducer pattern (server layer)
The server is a strict reducer wrapper:
```
client emits action  →  validate (rate limit, schema, seat ownership)
                     →  apply(snap, action) in the engine
                     →  if ok, replace room.snapshot
                     →  broadcastRoomState + broadcastViews (per-seat projection)
                     →  schedule next bot / turn timer
```
Every state mutation flows through `applyAction(room, playerId, action)`. There is exactly one
place game state changes per action; trace bugs from there.

### 5.3 PlayerView never leaks hidden info (Rule 0.3 expanded)
`projectView(snap, seat)` strips the other three hands to count-only and trims any field that
would reveal a private hand. `projectSpectatorView` strips **all** four hands. Reaching into
`room.snapshot.hands` from the server-to-client emit path is a security regression — use the
projections.

### 5.4 i18n discipline (Rule 0.5 expanded)
- `bg.ts` is the source of truth for `MessageKey`.
- `en.ts` must satisfy `Record<MessageKey, string>` — `tsc` enforces this.
- No literal Bulgarian strings in components. If you need a new message, add a key to both files
  in the same commit.
- Server-emitted error strings are English (internal); the client maps them to localized
  user-facing copy where appropriate.

### 5.5 Tests are scenarios (Rule 0.7 expanded)
Every game-rule subtlety has a named test. When you change game logic, you either change the
scenario name or you have not understood what your code does. Examples in `packages/engine/test/`:
*"belot is not double-counted when it also rides in the announcements list"*, *"inside: bidder
< defenders → defenders take everything (belot stays)"*. Aim for that level of clarity.

### 5.6 Commit & deploy discipline (Rule 0.8 expanded)
- Conventional Commits: `feat(scope): subject`, `fix(scope): subject`, `chore:`, etc.
- One logical change per commit. Squash before merging when several small fixes accumulate.
- **Working tree on `main` is always deployable.** Typecheck and build must be clean before
  every commit. Engine tests must pass before changes to engine logic land.
- A post-commit hook auto-pushes `main` to GitHub. Pushed commits trigger Render (server) +
  Netlify (client). Therefore an accidental commit is an accidental deploy — treat both
  carefully.
- For Supabase schema changes: write a new dated migration in `supabase/migrations/` and apply
  it via Studio or the Supabase MCP. Never edit a previous migration.

### 5.7 No emojis (Rule 0.6 expanded)
Not in code, not in comments, not in commit messages, not in i18n strings — unless the user
explicitly asks. Emojis are *for the UI when the design calls for them* (reactions: 👏 🤔 😂 🔥 🙏 😴
are an opt-in product feature, not generic chrome).

---

## 6. COMMON PITFALLS (NOTES-TO-SELF)

- **The match-score column counts in TENS.** Raw card-pool max per hand is 162 / 260 / 258 →
  divided by 10 that's ~16 / 26 / 26 per hand. A game to 151 typically takes 6–10 hands. If a
  single hand can end the match, scoring is wrong.
- **Equal hand totals = suspended (висящ), not inside.** Many simplified implementations treat
  ties as a bidder-loss; that's wrong for BG belote.
- **NT has no announcements.** Don't accidentally award терца / кварта / каре / белот in a
  No-Trumps hand.
- **Capot bonus is never doubled by NT.** It IS multiplied by contra/recontra (when
  `capotDoubledByContra` is true — default).
- **Belot is awarded on the SECOND K/Q-of-trump play by the same player.** Not when the player
  holds the pair, not when the first card is played.
- **Belot is scored once.** Despite riding in the announcements list (so the live banner can
  pop up mid-hand), `scoreHand` skips `kind:'belot'` entries and credits +20 only via
  `belotDeclaredBy`. Re-introducing the double-count is a regression — see the test
  *"belot is not double-counted when it also rides in the announcements list"*.
- **Over-trump exemption when partner is winning.** Players are NOT required to over-trump a
  trick their partner is currently winning.
- **Carrés trump sequences.** A team with a carré beats any opponent sequence regardless of length.
- **Auto-play on timeout uses the lowest-value legal card** — the same fallback the Easy bot uses.
- **Bots play with a delay.** `BOT_TURN_DELAY_MS = 750` is humane. Don't drop it to zero.
- **Bots stop when no human is connected.** `anyHumanConnected(room)` guard in `afterTransition`
  freezes the table when the last human leaves. The empty-room timer (`ROOM_EMPTY_GRACE_MS =
  30_000`) then deletes the room. Match results are **not** persisted for abandoned games.
- **RoomRoute remounts per code.** Per-room UI state (chosen, mode, nick, spectate-fallback)
  must not leak across `/r/A → /r/B` navigation — `RoomRoute` is a thin keyed wrapper around
  `RoomRouteInner`. If you ever undo the key, "stuck spectator" bugs return immediately.
- **Render env vars are the persistence trip-wire.** Without `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY`, `supabaseAdmin` is null and `persistMatchRow()` silently no-ops.
  `GET /debug/persist` is the canonical check — if `canWrite: false`, the table will stay empty.
- **Auto-push on commit.** Because the post-commit hook pushes `main` to GitHub, every commit
  is a deploy. This is intentional but unforgiving — never commit a half-finished refactor.

---

## 7. DESIGN SYSTEM — ATMOSPHERIC MINIMALISM

The complete brief lives in `design-prompt-belot.md`. The summary below is binding; deviations
must be justified in PR descriptions.

### 7.1 Philosophy: the two-tier split
The design operates on a **two-tier split**. Every screen belongs to one tier:

| Tier | Context | Visual weight |
|---|---|---|
| **A — Atmosphere** | Landing, Lobby (Tablo + waiting room), Auth, Menus, Results, Victory | Rich. Ornate. Cinematic. |
| **B — Battlefield** | Active bidding, Active play, Timer, HUD | Ultra-clean. High contrast. Zero decoration. |

Decoration is a reward for idle moments. During active play the UI disappears — only information
remains. A Tier-B screen that has corner ornaments, film grain, or ambient glow is a design bug.

### 7.2 Color tokens (CSS custom properties — never hardcode hex in components)
```
--ink:        #0a0f0d   /* background — deep night */
--felt:       #0e251c   /* table base */
--felt-mid:   #143b2e   /* table hover zones */
--felt-hi:    #1c5240   /* active table glow */
--brass:      #c9a25a   /* accent — USED SPARINGLY */
--brass-hi:   #e6c178   /* hover / active / selected */
--brass-dim:  #8a6a30   /* inactive brass — labels only */
--cream:      #f4eccb   /* primary text */
--paper:      #ece2c2   /* card face, secondary text */
--ember:      #7d1f2b   /* danger / contra */
--ember-hi:   #a4303f   /* contra hover / tension state */
--smoke:      #e8e2d1   /* hero subheadings */
--ash:        #9aa39c   /* metadata, disabled */
--void:       #050908   /* deepest black — overlays */
```

### 7.3 Brass rule (non-negotiable)
Brass is used **only** for:
- active player indicator
- selected card
- interactable CTA
- win state
- tournament / ranked badge

Brass is **never** used for passive borders, dividers, or labels. Before adding brass to anything,
the element must satisfy at least one of the above. If none apply → use cream, smoke, or ash.

### 7.4 Typography
```
Playfair Display (serif italic)
→ Use: Logo, hero headings, match result titles, tournament names, victory screen
→ Never use in gameplay HUD

Plus Jakarta Sans (sans-serif)
→ Use: All UI — navigation, buttons, labels, panel headings, room codes
→ Letter-spacing: 0.06em normal, 0.24em for eyebrow labels (uppercased small caps style)

JetBrains Mono (monospace)
→ Use: Scores, timers, trick counts, card point totals, room codes, history log
→ Never use decoratively — only for numeric/code data
```

### 7.5 Component states (every interactive component implements all eight)
| State | Treatment |
|---|---|
| default | Per design spec |
| hover | Brass-hi tint or lift (cards) |
| active / pressed | Slight scale 0.97, 80ms |
| focused | Brass 2px outline (keyboard nav) |
| disabled | 35% opacity, no pointer events |
| loading | Spinner in brass color, no layout shift |
| error | Ember border + ember text below field |
| success | Brass-hi border + ash confirmation text |

### 7.6 Mobile rules (<768px)
- Nav collapses to hamburger; full-screen dark overlay menu; monogram at top.
- Game table: rotated-landscape lock recommended. Portrait fallback: compact layout — hand at
  bottom, opponents stacked above, trick center reduced.
- Card touch target: **min 48×68px**.
- Button targets: **min 44px height**.
- **Disabled on mobile:** film grain, atmospheric glows, ornaments — performance + visual noise.
- Score panel: collapsible bottom sheet in portrait mode.
- Bidding buttons: full-width grid (2×3) for the six bid options.

---

## 8. UI/UX INTELLIGENCE

### 8.1 Two entry points — never more
The Табло hub has **two cards, not three**, after intentionally removing the public
"active rooms" list (an empty list looks dead at the worst moment — see §15):

1. **С приятели — Частна стая.** Big brass *Създай стая* button, then *„или с код"* divider +
   join-by-code input. Host owns the room: per-seat *+ бот*, manual *Старт*, capot toggle.
   Badge in the waiting room: **„Само с код"**.
2. **Срещу други онлайн — Бързо намиране.** Single button that calls `mm:join` → server
   finds/creates a public room and returns its code → client navigates to `/r/<code>`. Badge in
   the lobby: **„Бързо намиране"**. The room behaves like any room but with two extra mechanics
   (§8.4 + §8.5).

### 8.2 Lobby (Чакалня) — the slot board
- Centerpiece: an **oval SVG table** on `sm+`, a vertical seat card list on mobile.
- Each seat shows nickname + status (online / offline / bot) and an initial avatar.
- Room code + a single-tap *Копирай* of the invite link.
- Private rooms only: *Правила на масата* (capot toggle for now; NT/AT toggles future).

### 8.3 Quick-match: vote to fill bots
When fewer than four humans are seated and the game hasn't started, every seated human can
press **Добави ботове (n/m)** where `m = floor(humanCount/2)+1` (majority of seated humans).
When the vote crosses the threshold, the server fills the empty seats with bots and starts the
game. A solo searcher reaches threshold instantly (1/1).

### 8.4 Quick-match: fallback timer
On creation, a quick-match room arms a **30-second timer** (`QUICK_FILL_AFTER_MS`). If no one
has voted and the game hasn't started, the server fills with bots automatically and starts. The
table never stalls.

### 8.5 Auto-start at four humans
When the fourth human joins a quick-match room, `autoStartOnFill` triggers `startGame` —
no vote needed. The lobby is the gathering, not a roadblock.

### 8.6 In-game HUD (Tier B — Битката)
- Top bar: `← Напусни` · *Стая X4K9* · *НС:47 · ИЗ:63* · *X хора · Y ботове* · *⏱ 0:18*.
- The composition chip *(X хора · Y ботове)* answers the immediate "who am I playing with?"
  question — especially in quick match.
- Scores in JetBrains Mono. Timer turns ember below 10s (no animation — just color).
- *Напусни* requires a confirm modal during an active game.

### 8.7 Hand result overlay (Резултат на ръка)
Modal over `--void/85`. Breakdown rows: карти · обявки · белот · капо. Result badge:
*ИЗКАРАНА* (brass) / *ВКАРАНА* (ember) / *ВИСЯЩА* (ash) in Playfair italic. Running match score
below. *Следваща ръка* primary CTA — auto-dismissed after 8 seconds.

### 8.8 Victory / defeat cinematic
Full viewport, felt background. Winner team in large Playfair *ПОБЕДА* — brass, with SVG laurel.
Loser team smaller, ash. Hand-by-hand history accordion. Action row: *Нова игра* · *Лоби* ·
*Сподели резултат*. Brass glow on the victor side, ember glow on the loser side. **Match is
persisted server-side here** (see Rule 0.4 and `maybePersistMatch`).

### 8.9 Notifications (browser turn alerts + sound)
Opt-in in Settings → Известия. Toggling on requests the Notifications permission. When it
becomes your turn while the tab is hidden, fire a notification. When it becomes your turn at
all, optionally play a short WebAudio chime. Wiring lives in `lib/notify.ts` → `useTurnNotifier`,
called from `RoomRoute`.

### 8.10 Reducing confusion (cognitive load rules)
- One primary action per Tier-A panel.
- During play (Tier B): **no marketing copy**, **no banner ads**, **no upsells**.
- Error states are inline, never alert/confirm popups.
- Active player indicator: **static glow + brass label**, never a pulsing animation (§9).

---

## 9. MOTION SYSTEM

### 9.1 Allowed motions (Tier B — Battlefield)
- Card play: **180ms ease-out** translate from hand position to table center.
- Trick sweep: **300ms**, cards slide to trick winner's corner.
- Card hover: **120ms lift +4px**. No rotation.
- Active player transition: **80ms opacity change** on seat label. Nothing else.
- Timer color: **instant** on threshold, no transition.

### 9.2 Allowed motions (Tier A — Atmosphere)
- Brass pulse on active player in lobby: slow 3s sinusoidal, max 10 % brightness delta.
- Victory screen entrance: 400ms fade-in, single upward translate on the headline.
- Contra wash: 200ms ember color fill on the bid zone.
- Page transitions: 150ms fade only. No slide, no zoom.

### 9.3 Banned everywhere
- Continuous background animations.
- Decorative element entrance animations.
- Bounce or spring easings on game-critical elements.
- Any animation > 400ms during active play.
- Pulsing on Tier B (kills focus on the cards).

### 9.4 `prefers-reduced-motion`
Wrap every framer-motion entrance with a reduced-motion fallback. The salon should be calm for
everyone; some players need it absolutely still.

---

## 10. PAGE BLUEPRINTS

### 10.1 Landing ( `/` ) — Tier A
- Hero: full viewport, felt texture, monogram centered, Playfair headline (BG: *"Четири играча.
  Една маса. Белот."*), brass CTA *„Играй безплатно"*, subline in smoke, corner ornaments,
  atmospheric ember glow top-right, brass glow bottom-left.
- Feature strip (3 columns), How it works (3 steps), Social proof (player counts in Mono),
  Rules teaser, Footer.

### 10.2 Табло ( `/tablo` ) — Tier A
- Greeting (Playfair italic).
- Two-card row: **С приятели** + **Срещу други онлайн** (see §8.1). **No active-rooms list.**
- Right sidebar: stats (wins this week, streak, total games). Link to profile.
- Recent games (left column under the action cards).

### 10.3 Waiting room ( `/r/:code` before game start ) — Tier A
- Header: monogram, *Стая № XXXXXX* (Mono brass-hi), badge *Само с код* / *Бързо намиране*.
- Oval table SVG (desktop) / MobileSeatList (mobile).
- Filled counter, invite link + copy (private only), rules panel (private host only).
- Bottom: *Старт* (private host) or *Добави ботове (n/m)* (quick-match) + quick wait hint.

### 10.4 Bidding ( `/r/:code` during BIDDING ) — Tier B
- Flat `#0e251c` background. No grain, no glow, no ornaments.
- HUD top: score row, room code, composition (X хора · Y ботове), timer.
- Center: current highest bid, who bid it.
- Bid grid: PASS (ghost), C D H S NT AT (cream), КОНТРА (ember), РЕКОНТРА (ember-hi). Only
  legal actions enabled; illegal = opacity 0.3, no pointer events.
- Hand preview (bottom): 5 cards face-up, non-interactive during opponent's turn.
- Bid history sidebar (desktop) / drawer (mobile) in Mono.

### 10.5 Play ( `/r/:code` during PLAYING ) — Tier B
- Same flat background, same HUD.
- Center: current trick cards in N/E/S/W positions. Winning card outlined in brass (static).
- Player hand (bottom): 8 cards → depletes to 0. Legal cards: full opacity, +4px hover lift.
  Illegal: 50 % opacity, no hover.
- Score column (right, fixed): current trick points per team in Mono.
- Announcements strip (trick 1 only): *„Каре от валета — НС +200"*. Auto-dismiss after 4s.
- Active player: only the seat label brightens to brass-hi.

### 10.6 Profile ( `/profil/:username` ) — Tier A
- Header: avatar (large), username (Playfair), rank badge (brass for ranked).
- Stats row: Победи · Загуби · Win% · Streak · Любим договор.
- Recent games table (20 rows): score, result (Изкарана/Вкарана), contract, date.
- Announcements history aggregate (карé от валета count, квинта count, etc.).

### 10.7 Tournaments ( `/turniri`, `/turniri/:id` ) — Tier A
- Browse: Предстоящи / Активни / Приключили tabs. Tournament cards (name, date, players, prize).
- Detail: bracket SVG, participants list, *Играй мач* (when ready) — the **winner is set
  automatically** by the server when the linked match finishes (manual winner reporting was
  removed and is blocked by a DB trigger).

### 10.8 Settings ( `/nastroyki` ) — Tier A (utility — no ornaments)
- **Профил**: nickname (with case-sensitive availability check) + sync-to-account.
- **Игра**: card back, sound, animations, language.
- **Известия**: turn alerts (Web Notifications) + turn sound.
- **Акаунт** (auth required): change password, change email, delete account (typed confirmation;
  hits server `POST /account/delete` which uses service-role).
- **Поверителност**: links to policy + data export.

### 10.9 Auth pages — Tier A (form focus)
- Centered card on felt. Monogram above form. Plate-cream panel. Brass CTA. OAuth (future)
  goes above email/password, never below.
- Forgot / reset password: minimal centered form.

---

## 11. COPYWRITING SYSTEM

### 11.1 The voice
Speak to a Bulgarian belot player who knows the game, has limited patience for marketing, and
appreciates a well-set table. Native Bulgarian. **"ти"** form (familiar but respectful). Small
touches of French-salon vocabulary as brand color (*Le Salon de Belot*, *Le Carré*) — never as
jargon a player must decode. Never Gen-Z slang. Never corporate "Welcome to our platform".

### 11.2 Headline formula
```
[Specific game truth] + [direct invitation]
OR
[Outcome the player wants] + [no friction]

Examples:
✅ "Четири играча. Една маса. Белот."
✅ "Играй безплатно — без реклами, без регистрация."
✅ "Стая за приятели за 5 секунди."
❌ "Добре дошли в Le Salon de Belot" (says nothing)
❌ "Платформа за карти" (generic)
```

### 11.3 CTA copy rules
Primary CTAs are always **imperative + concrete game action**:
```
✅ "Играй безплатно"
✅ "Създай стая"
✅ "Бързо намиране"
✅ "Влез с код"
✅ "Започни играта"
❌ "Научи повече"
❌ "Продължи"
❌ "Submit"
```

### 11.4 Empty states
```
No active rooms (deprecated — see §15): the section no longer exists.

No recent games:
"Все още не си играл — пусни първата игра."

No tournaments registered:
"Все още не си регистриран в турнир. Виж активните →"

Quick-match lobby with one player:
"Чакаме играчи. Гласувай за ботове или изчакай — при 4-ма масата тръгва, иначе ботове допълват."
```

### 11.5 Error messages
```
Generic socket failure:
"Връзката със сървъра прекъсна. Провери интернета си."

Room not found:
"Тази стая я няма. Стаята е изтекла, домакинът я е затворил, или линкът е сбъркан."

Username taken (Settings):
"Това име вече е заето. Избери друго."

Login failure:
"Грешна парола или имейл. Опитай отново или → Забравена парола?"

Reconnect token missing (guest reclaim from a different device):
"reconnect token required" → client surfaces this as a friendly "Тази сесия не е твоя — отвори
линка отново на устройството, от което си играл."
```

### 11.6 Bulgarian language rules
- "ти" throughout. Formal "Вие" feels like a government portal — wrong tone for a salon.
- Accent marks correct. *„специалността"*, not *„специалноста"*.
- Date format: *15 юли 2026 г.*
- French-salon brand terms (Le Salon, Bonsoir, Le Carré) — sparingly, only on brand surfaces,
  never as functional UI labels.
- Server-internal error codes stay English; the client maps them to Bulgarian.

---

## 12. GROWTH ENGINE

Belot is a social game. Every growth lever is "this player brings their next three players."
We never grow via paid ads; we grow because the table feels right and people invite their
friends to sit at it.

### 12.1 Private-room invite link (the primary growth loop)
The Create-room flow ends with a copyable URL. Make it one tap on mobile, one click on desktop.
The link survives refresh, supports auto-spectate fallback for late-joiners, and never requires
a login to view the lobby.

### 12.2 Quick-match: kill the "dead table" feeling
With a small concurrent player base, a browse-able room list shows zero rooms and the site
feels abandoned. Quick match hides the void — you either land in a shared lobby with whoever's
searching, or your own lobby fills with bots in ≤30s. Either way, you are at a table within
seconds. This was a deliberate trade-off; see §15 for the moat argument.

### 12.3 Victory share card (planned)
After the victory cinematic: a *„Сподели резултат"* CTA that generates a 4:5 shareable PNG
(team scores, contract list, opponent nicknames). Optimised for Viber, Messenger, WhatsApp.
Implementation: HTML5 canvas, no backend. Never include opponents' PII beyond the nickname
they themselves chose to display.

### 12.4 Tournaments as a social anchor
Recurring tournaments (weekly, monthly) give a reason to return on a schedule. Bracket pages
are shareable URLs; participants invite friends to spectate the final.

### 12.5 Trust-preserving growth rule
Never ask for a share before delivering value. The *Сподели* button shows up **after** the
victory, not after the first card play. Sharing is generosity, not a transaction.

---

## 13. RETENTION SYSTEM

The Belot Online retention loop is "I had a good game last night; I want another tonight."
Design for evenings — that is when the salon fills.

### 13.1 Recent games as a return anchor
The Табло hub shows the last 5–6 finished games with score, opponents, win/loss colouring.
Players return to see if last night's friends came back online. This pulls from
`public.matches` — which is **only populated when the server's `supabaseAdmin` is configured**
(see Rule 0.4).

### 13.2 Profile stats over time
Wins this week, streak, total games, favourite contract, announcement history. These numbers
must move. If a player wins three games and the stats don't update, they will not come back.
Persistence must not lie.

### 13.3 Leaderboard (Класация)
Weekly / monthly / all-time tabs. The own-rank card pinned at the bottom is the magnet —
*"I'm rank 87, I want to be 50."*

### 13.4 Tournaments (recurring schedule)
A predictable cadence (e.g. weekly Sunday 20:00, monthly first Saturday) trains players to
return on the schedule. The bracket page is the social hub during the event.

### 13.5 Notifications worth opening
Only notify when something has actually happened:
```
✅ "Турнирът „Седмичен" започва след 1 час."
✅ "Имаш покана за стая XK4P9 от Иван."
✅ Browser notification: "Белот — твой ред" (Settings opt-in)
❌ "Ела пак, отдавна не си играл" (needy)
❌ Weekly digest with no real content
```

### 13.6 Profile is the home, not the leaderboard
The first thing a returning player wants to see is *their* progress, not the global table.
Make the profile feel like a personal record book. Brass for victories, ash for losses,
ember for ranked, monospace for every number.

---

## 14. MONETIZATION ARCHITECTURE

Belot Online is and should remain free for all players. The free core is what earns trust
and grows the player base. Monetization sits **on top of** the trust layer — never under it.

### 14.1 The monetization stack

**Tier 1 — Zero ethical risk (build first)**

1. **Premium subscription** (planned via Stripe Checkout)
   - Custom avatars, advanced match history, no future ads, priority matchmaking, tournament
     access. *Never* gates the rules engine, the leaderboard, or basic gameplay.
   - Backend: server endpoint creates Checkout Session; Stripe webhook flips
     `profiles.is_premium`. See `routes/Premium.tsx` and the integration plan.
   - Price: ~4.99 лв / month (final price TBD with the user).

2. **Tournament entry — sponsored prizes**
   - Free entry, prize sponsored by a partner; partner logo on the bracket page (clearly
     labelled "Партньор"). Never affects standings, rules, or matchmaking.

**Tier 2 — Requires careful design**

3. **Cosmetic shop** (card backs, avatars, table themes)
   - Pure cosmetics. Never affects gameplay. Never randomized loot boxes — explicit purchase,
     known item.

**Never on the table:**
- ❌ Paying for accuracy of the rules engine.
- ❌ Paying to remove ads (there are none).
- ❌ Pay-to-win cards / bots / hints.
- ❌ Selling player data.
- ❌ Targeted advertising of any kind.

### 14.2 Placement rules
```
WHERE to show premium prompts:
✅ Premium page (dedicated, never surprising)
✅ Profile, under "Разшири" (gentle, never blocking)
✅ Footer
✅ One-time, after a clearly positive moment (e.g. a tournament win)

WHERE to never show premium prompts:
❌ Mid-game (Tier B is sacred)
❌ As a modal blocking the victory screen
❌ As a wall before the leaderboard
❌ On the Табло (the hub stays clean)
```

### 14.3 Copy rules for Premium
Never frame the free tier as "missing something":
```
✅ "Премиум: персонализирани аватари и приоритетен matchmaking"
❌ "Отключи всички функции" (deceptive — basic features are not locked)
```

---

## 15. BRAND MOAT / DISTINCTIVENESS

A moat is when someone sees a colour, a layout, or a single interaction and instantly knows
*"that's Belot Online."* Without seeing the logo. Here is what to build and protect.

### 15.1 The core visual metaphor: the salon
**"Le Salon de Belot"** — an elegant evening room with a brass-rimmed felt table, where the cards
behave correctly and the company is good. Every design decision should reinforce *salon* over
*casino*:
- Felt green, brass accent, cream text — never neon, never red-and-gold slot palette.
- Playfair Display italics for the brand voice — never sans-serif "tech startup" headlines.
- Corner ornaments (Tier A only) — small, restrained, never flashing.
- Reactions are six tasteful emoji, not animated gifs.

### 15.2 The two-tier UX is the moat
No other Bulgarian belot site separates **atmosphere** from **battlefield**. This is the
clearest brand differentiator: when a player sits down, the decoration disappears and they are
alone with the cards. Tier B is ruthlessly minimal because every other belot site is the
opposite. Protect this distinction at all costs.

### 15.3 Signature UI patterns
1. **Brass-rimmed oval table** in the lobby (SVG; viewBox 920×600). Recognisable from a glance.
2. **Composition chip** *(X хора · Y ботове)* in the in-game HUD. Quickly tells you who you're
   playing with — no other belot UI does this.
3. **Static brass active-player glow** — never a pulse. The calm at the table is the brand.
4. **Mono room code in brass tracking-[0.32em]** — visually recognisable across screens.
5. **Tier-B has no chrome** — clean enough to feel almost like a printed page.

### 15.4 Tone of voice as moat
*„ти"* form, salon-flavoured Bulgarian, never English residue, never corporate "Welcome". A
player who reads three sentences of UI copy should know they are at Le Salon.

### 15.5 What to avoid (anti-moat)
- ❌ Casino reds and golds — they look like every other ad-funded card site.
- ❌ Animated backgrounds, chip showers, jackpot fanfares — opposite of the salon.
- ❌ "Free coins!" mechanics — destroys the trust the rules-correctness builds.
- ❌ Default React UI components (drop-shadow cards, rounded-2xl everything, blue primary
  button) — they make us look like every other template.

---

## 16. EXECUTION CHECKLIST (BEFORE WRITING A LINE OF CODE)

Before any new component, route, or feature, walk through this:

### 1. Tier identification
Is this Tier A (atmosphere) or Tier B (battlefield)? The visual rules are different. If it's
both at different states (e.g. the lobby vs the play view in the same route), make the
transition unambiguous (`tier-b` class on the play view drops grain to 0).

### 2. Server authority
Could a malicious client lie about anything here? If yes, the server validates it. If you are
about to add logic to the client that "decides" something a hostile player would want to lie
about — stop. Move it to the server.

### 3. Engine purity
Does this touch the engine? If yes — no Date, no IO, no globals. Pure functions only.

### 4. i18n
Every visible string in `bg.ts` + `en.ts` in the same commit. No literal Bulgarian in JSX.

### 5. Mobile-first
Code the small-screen layout first. Touch targets ≥44px, card targets ≥48×68px. Test at
375 / 390 / 430px.

### 6. Brass usage
If you used brass anywhere, does it satisfy the brass rule (§7.3)? If not, swap to cream/smoke/ash.

### 7. Motion compliance
Tier B: only the four allowed motions (§9.1). Tier A: only the allowed motions (§9.2). No
continuous background animations, no pulsing on Tier B.

### 8. Copy check
Headline is outcome-focused (§11.2). CTA is imperative + concrete (§11.3). Empty state and
error message are written (§11.4, §11.5). All Bulgarian, "ти" form.

### 9. Persistence (if game-finishing)
Server-only writes (Rule 0.4). Diagnostic `GET /debug/persist` available. Wins land in
`public.matches`, leaderboard updates, profile updates.

### 10. Security
RLS strict on user data. Service role only on the server. No client-side write to `matches` /
`tournament_matches.winner_id`. Rate limits on Socket.IO events that mutate state.

### 11. Test scenarios
Every game-rule change has a named scenario test. Tests describe what, not how (§5.5).

### 12. Build cleanliness
`tsc --noEmit` clean on client + server. Engine tests pass. `main` is always deployable
(Rule 0.8).

---

## 17. REFERENCES

- **Game rules (primary source):** <https://belot.bg/belot/rules/> (Casualino JSC, Bulgarian).
- **Design brief (atmospheric minimalism, full screen inventory):** `design-prompt-belot.md`.
- **Project spec:** `C:\Users\atana\.claude\plans\project-spec-belot-online-tender-duckling.md`.
- **Audit report (security + performance, dated):** `audit-report.md`.
- **Strategic matchmaking analysis (the four-player problem):** see in-session notes — drove the
  design of §8.1–§8.5 (two entry points, vote + fallback timer, no public rooms list).

---

## graphify

This project has a knowledge graph at `graphify-out/` with god nodes, community structure,
and cross-file relationships, built by the project-scoped `graphify` skill
(`.claude/skills/graphify/SKILL.md`).

Rules:
- For codebase questions, first run `graphify query "<question>"` when `graphify-out/graph.json`
  exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"`
  for focused concepts. These return a scoped subgraph, usually much smaller than
  `GRAPH_REPORT.md` or raw grep output.
- If `graphify-out/wiki/index.md` exists, use it for broad navigation instead of raw source
  browsing.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or when query / path /
  explain do not surface enough context.
- After modifying code, run `python -m graphify update .` to keep the graph current
  (AST-only, no API cost). Scope to `packages/` if needed to avoid scanning generated dirs.
- `graphify-out/` is gitignored (see `.gitignore`). The graph itself is regenerable; only the
  skill configuration in `.claude/` is version-controlled.
