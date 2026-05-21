# Security & Performance Audit — Белот Online
*Generated: 2026-05-21*

Scope audited: `packages/{server,engine,client,shared}/src`, server `.env`/`.env.example`, all `package.json`, `vite.config.ts`, `tsup.config.ts`, and all `supabase/migrations/*.sql`. Findings reference real code with file:line.

Overall posture: **solid for a friends-and-bots MVP**. The realtime game core is genuinely server-authoritative, per-seat views never leak hidden hands, inputs are Zod-validated, CORS is correctly locked to explicit origins, JWTs are verified locally, and secrets are gitignored. The dangerous gap is **persistence integrity**: match results and tournament outcomes are written *from the browser* under permissive RLS, so leaderboards and brackets are forgeable. That is the thing to fix before any competitive/public use.

---

## SUMMARY SCORECARD

| Category | Issues Found | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| Authentication & Authorization | 3 | 0 | 0 | 1 | 2 |
| Input Validation | 1 | 0 | 0 | 0 | 1 |
| CORS & Transport | 1 | 0 | 0 | 0 | 1 |
| Rate Limiting & DoS | 2 | 0 | 0 | 2 | 0 |
| Data Leakage | 1 | 0 | 0 | 0 | 1 (INFO) |
| Cryptography | 1 | 0 | 0 | 0 | 1 |
| Performance — CPU | 1 | 0 | 0 | 0 | 1 |
| Performance — Memory | 1 | 0 | 0 | 0 | 1 |
| Performance — Network | 1 | 0 | 0 | 0 | 1 |
| Supabase Configuration | 3 | 0 | 2 | 1 | 0 |
| Architecture Gaps | 2 | 0 | 0 | 1 | 1 |

Severity headline: **2 HIGH** (leaderboard forgery, tournament forgery), **5 MEDIUM**, the rest LOW/INFO. No CRITICAL (no RCE, no hidden-hand leak, no committed secret).

---

## FINDINGS

### [SEC-001] Client-authoritative match persistence enables leaderboard / stat forgery

- **Severity:** HIGH
- **File:** `packages/client/src/lib/matchPersist.ts:22` ; `supabase/migrations/20260519_matches_insert_policy.sql:18`
- **Category:** Auth / Supabase
- **Description:** The game server is authoritative for *gameplay*, but it does **not** persist results. Finished matches are written **from the browser** by the authenticated Supabase client. The RLS insert policy only requires that `auth.uid()` equals **any one** of the four seat ids. An authenticated user can therefore insert arbitrary `matches` rows — any scores, any `winner_team`, fabricated opponents — provided they place their own uid in a single seat. Leaderboard, win%, streaks and profile history all derive from this table.
- **Evidence:**
```ts
// matchPersist.ts:22 — runs in the browser, fully attacker-controlled
const { data: inserted, error } = await supabase
  .from('matches')
  .insert({
    room_code: room.code,
    score_ns: view.matchScore.NS,   // values come from client state
    score_ew: view.matchScore.EW,
    winner_team: nsWon,
    ...
  })
```
```sql
-- 20260519_matches_insert_policy.sql:18
create policy matches_insert_self on public.matches
  for insert to authenticated
  with check (auth.uid() = seat_n_id or auth.uid() = seat_e_id
           or auth.uid() = seat_s_id or auth.uid() = seat_w_id);
```
- **Impact:** Any signed-in user can fabricate unlimited wins (or losses for rivals they name), poisoning the public leaderboard and every stat surface. Competitive integrity is zero.
- **Fix:**
```ts
// SERVER (packages/server/src) — persist authoritatively on GAME_OVER.
// In afterTransition(), when room.snapshot.phase === 'GAME_OVER':
import { supabaseAdmin } from './supabase.js'
async function persistMatch(room: Room) {
  if (!supabaseAdmin || !room.snapshot) return
  const s = room.snapshot
  // server controls every value; map authed seats to their verified uids
  await supabaseAdmin.from('matches').insert({
    room_code: room.code,
    seat_n_id: authedUid(room, 2), seat_e_id: authedUid(room, 3),
    seat_s_id: authedUid(room, 0), seat_w_id: authedUid(room, 1),
    score_ns: s.matchScore.NS, score_ew: s.matchScore.EW,
    winner_team: s.matchScore.NS >= s.matchScore.EW ? 'NS' : 'EW',
    hand_count: s.handHistory.length,
    settings: room.settings, summary: { handHistory: s.handHistory },
    started_at: new Date(room.createdAt).toISOString(),
  })
}
```
```sql
-- Then revoke the client write path entirely:
drop policy if exists matches_insert_self on public.matches;
revoke insert on public.matches from authenticated;
-- service_role bypasses RLS, so the server insert above still works.
```
- **Effort:** L

---

### [SEC-002] Tournament results can be falsified by either participant

- **Severity:** HIGH
- **File:** `supabase/migrations/20260518_phase_d_tournaments.sql:147` ; `packages/client/src/lib/matchPersist.ts:58`
- **Category:** Auth / Supabase
- **Description:** `tmatches_update_player` lets **either** `player_a` or `player_b` set `winner_id` to **either** participant. There is no check that the reported winner matches the actual game outcome. A losing player can simply set `winner_id = own uid`; the `propagate_tournament_winner` trigger then advances them to the next round and can ultimately crown them champion.
- **Evidence:**
```sql
-- phase_d:147
create policy tmatches_update_player on public.tournament_matches
  for update to authenticated
  using (auth.uid() = player_a_id or auth.uid() = player_b_id)
  with check (winner_id is null
           or winner_id = player_a_id
           or winner_id = player_b_id);  -- no tie to real result
```
- **Impact:** Any bracket can be hijacked by a single dishonest participant. Tournament integrity is unenforceable.
- **Fix:** Make the server the only writer of `winner_id`, keyed off the authoritative `matches` row it just inserted (SEC-001), and resolve which team the bracket players were on before deciding the winner:
```sql
drop policy if exists tmatches_update_player on public.tournament_matches;
-- no authenticated update policy → only service_role (server) can advance brackets
revoke update on public.tournament_matches from authenticated;
```
```ts
// server, after persisting the match: link + report winner from real scores
await supabaseAdmin.from('tournament_matches')
  .update({ match_id, winner_id: realWinnerUid, status: 'finished' })
  .eq('room_code', room.code)
```
- **Effort:** M

---

### [SEC-003] Public `test_demo` table allows anonymous unlimited inserts

- **Severity:** MEDIUM
- **File:** `supabase/migrations/20260520190218_create_test_table.sql:17`
- **Category:** Supabase / DoS
- **Description:** A leftover demo table has RLS enabled but an insert policy of `with check (true)` open to all roles. Any anonymous client holding the public anon key (which ships in the browser bundle) can insert unlimited rows.
- **Evidence:**
```sql
create policy "Allow all to insert test_demo"
  on public.test_demo for insert with check (true);
```
- **Impact:** Free storage-abuse / row-flood vector against the project's database, usable by anyone who views the site (the anon key is public by design).
- **Fix:**
```sql
drop table if exists public.test_demo cascade;
```
Also delete the migration file so it isn't re-applied.
- **Effort:** XS

---

### [SEC-004] Guest seat hijack via leaked `playerId`

- **Severity:** MEDIUM
- **File:** `packages/server/src/index.ts:492` ; `packages/server/src/room.ts:120`
- **Category:** Auth
- **Description:** For guests, the client-supplied `playerId` (a localStorage UUID) **is** the seat secret. The server reconnect path matches on it (`findSeatByPlayerId`) and re-binds the socket to that seat. Anyone who learns a guest's `playerId` — via a shared device, screen-share, client logs, or a co-player who can observe it — can take over that seat. Authenticated users are safe because the server forces `playerId = JWT uid` (`index.ts:492`).
- **Evidence:**
```ts
// index.ts:492 — guests fall through to whatever the client sent
const resolvedPlayerId = authedUser?.id ?? parsed.data.playerId
...
const existingSeat = findSeatByPlayerId(room, resolvedPlayerId) // seat takeover on match
```
```ts
// identity.ts:23 — guest secret lives in localStorage, travels in every payload
map[key] = crypto.randomUUID()
```
- **Impact:** Seat/identity takeover within guest games (kick the rightful player off their seat mid-match). Bounded to guests; UUID entropy makes blind guessing impractical, so this needs a leak.
- **Fix:** On first guest join, mint a server-side HMAC-signed session token bound to the socket; require it on reconnect instead of trusting a raw client UUID:
```ts
import { createHmac, randomBytes } from 'node:crypto'
function mintGuestToken(roomCode: string, seat: Seat) {
  const nonce = randomBytes(8).toString('hex')
  const sig = createHmac('sha256', process.env.GUEST_SECRET!)
    .update(`${roomCode}:${seat}:${nonce}`).digest('hex')
  return `${nonce}.${sig}` // verify on reconnect; never derive identity from raw client input
}
```
- **Effort:** M

---

### [SEC-005] No spectator cap — memory + broadcast amplification DoS

- **Severity:** MEDIUM
- **File:** `packages/server/src/index.ts:576` ; `packages/server/src/room.ts:215`
- **Category:** DoS
- **Description:** `addSpectator` enforces no limit. One actor opening many sockets can register unlimited spectators in a single room; each grows the `spectators` Map and each `room:spectate` triggers a `broadcastRoomState` to the whole room.
- **Evidence:**
```ts
// room.ts:215
export function addSpectator(room: Room, playerId: string, nickname: string) {
  room.spectators.set(playerId, { playerId, nickname }) // unbounded
}
```
- **Impact:** Memory growth + fan-out amplification per room; modest but unmetered.
- **Fix:**
```ts
const MAX_SPECTATORS = 50
if (room.spectators.size >= MAX_SPECTATORS)
  return cb({ ok: false, error: 'spectator limit reached' })
```
- **Effort:** S

---

### [SEC-006] No global room ceiling; matchmaking creates rooms outside the per-IP limit

- **Severity:** MEDIUM
- **File:** `packages/server/src/index.ts:107` ; `index.ts:352`
- **Category:** DoS
- **Description:** REST `POST /rooms` is limited to 10 rooms / 10 min / IP (`allowRoomCreate`), but (a) matchmaking creates rooms server-side with no equivalent cap, and (b) there is no global ceiling on total rooms nor a per-authenticated-user cap. Behind NAT/proxy or via rotating IPs, an attacker can accumulate rooms, each holding state + up to four timers for `ROOM_EMPTY_GRACE_MS` (60s) after going empty.
- **Evidence:**
```ts
const allowRoomCreate = makeIpLimiter(10, 10 * 60_000) // only the REST path
// startMatchmakingRoom / startMatchmakingRoomWithBots create rooms with no cap
```
- **Impact:** Unbounded in-memory room growth → memory pressure / instance instability.
- **Fix:** Add a global ceiling and evict the oldest empty room when exceeded:
```ts
const MAX_ROOMS = 5000
if (rooms.size >= MAX_ROOMS) {
  const oldestEmpty = [...rooms.values()]
    .filter(noOccupantsConnected).sort((a,b)=>a.createdAt-b.createdAt)[0]
  if (oldestEmpty) { clearTimer(oldestEmpty); clearBotTimer(oldestEmpty);
    clearTrickResolveTimer(oldestEmpty); rooms.delete(oldestEmpty.code) }
  else return cb({ ok:false, error:'server at capacity' })
}
```
- **Effort:** M

---

### [SEC-007] Socket identity is never re-verified after the handshake

- **Severity:** LOW
- **File:** `packages/server/src/index.ts:421` ; `packages/client/src/lib/auth.ts:75`
- **Category:** Auth
- **Description:** `socket.data.user` is captured once at connect (`index.ts:421`) and `game:action` never re-checks token expiry. The server *offers* an `auth:refresh` event, but the client never calls it — `auth.ts` subscribes to `onAuthStateChange` yet has no hook that forwards refreshed tokens to the socket. So an authenticated socket stays "authed" for its entire lifetime regardless of token expiry/revocation. (On socket.io auto-reconnect the auth callback in `store/game.ts` does re-fetch a fresh token, so reconnects re-verify.)
- **Evidence:**
```ts
// index.ts:421 — captured once, never refreshed for the socket's lifetime
const authedUser = (socket.data as { user?: AuthedUser | null }).user
```
```ts
// auth.ts:75 — refresh updates the store but never notifies the socket
supabase.auth.onAuthStateChange((_event, session) => {
  void useAuth.getState().setSession(session)   // no socket.emit('auth:refresh', …)
})
```
- **Impact:** Token revocation does not propagate to a live socket. Low — the identity was validated once and the uid is stable; a card game has little to gain from a stale-but-valid session.
- **Fix:** Wire the client refresh into the socket, and/or re-verify periodically server-side:
```ts
supabase.auth.onAuthStateChange((_e, session) => {
  useGame.getState().socket?.emit('auth:refresh', { token: session?.access_token })
})
```
- **Effort:** S

---

### [SEC-008] Any seated player (not just host) can start the game or add bots

- **Severity:** LOW
- **File:** `packages/server/src/index.ts:537` ; `index.ts:640`
- **Category:** Auth
- **Description:** `room:start` and `room:addBot` check only that the caller is *seated*, not that they are the host. `room:setSettings` (`index.ts:621`) correctly checks `room.hostId === playerId`; these two diverge from that and from the design spec ("Старт — only for host").
- **Evidence:**
```ts
// index.ts:541
if (findSeatByPlayerId(room, playerId) === null)
  return cb({ ok: false, error: 'only seated players can start' })  // not host-gated
```
- **Impact:** A non-host can start prematurely or fill seats with bots, mild griefing. No data risk.
- **Fix:**
```ts
if (room.hostId !== playerId) return cb({ ok:false, error:'only host can start' })
```
- **Effort:** XS

---

### [SEC-009] Input validation & XSS surface — clean (positive finding)

- **Severity:** INFO
- **File:** `packages/client/src/lib/identity.ts:9` ; whole client
- **Category:** Input
- **Description:** Greps for `eval(`, `innerHTML`, `dangerouslySetInnerHTML` returned **no instances** (XSS via raw HTML injection is not present). The only `JSON.parse` of untrusted data (`identity.ts:9`, localStorage) is wrapped in try/catch. Nicknames are sanitized server-side (`sanitizeNickname`, `index.ts:74`) before storage/broadcast, stripping `<>&"'/` and control chars. Every socket handler and REST body uses Zod `safeParse`. No action needed; documented for completeness.
- **Impact:** None.
- **Fix:** None.
- **Effort:** XS

---

### [SEC-010] Real secrets present in working tree (not committed)

- **Severity:** INFO
- **File:** `packages/server/.env`
- **Category:** Leak
- **Description:** `packages/server/.env` contains a live `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, and anon key. Verified via `git ls-files` / `git check-ignore`: the file is **gitignored and untracked** (only `.env.example` placeholders are committed). Risk is therefore local-machine only. Separately, `SUPABASE_ANON_KEY` is set in the *server* env but the server never reads it.
- **Evidence:**
```
$ git check-ignore packages/server/.env  → packages/server/.env  (ignored)
$ git ls-files | grep .env                → only *.env.example tracked
```
- **Impact:** None as long as `.env` stays uncommitted. If it ever lands in history, the service-role key bypasses all RLS and must be rotated immediately.
- **Fix:** Keep as-is; rotate keys if ever committed; drop the unused `SUPABASE_ANON_KEY` from the server `.env`/`.env.example`.
- **Effort:** XS

---

### [PERF-001] Single-instance in-memory state — no horizontal scaling

- **Severity:** MEDIUM (Architecture)
- **File:** `packages/server/src/index.ts:129,346` ; `packages/server/src/room.ts:44`
- **Category:** Architecture / Perf-Mem
- **Description:** `rooms`, `mmQueue`, per-room `spectators`, and the IP rate-limit buckets are all in-process `Map`s. The server cannot run more than one instance without a Socket.IO Redis adapter and a shared room store; a restart drops every live game.
- **Evidence:**
```ts
const rooms = new Map<string, Room>()           // index.ts:129
const mmQueue = new Map<string, MMEntry>()       // index.ts:346
spectators: Map<string, Spectator>               // room.ts:44
```
- **Impact:** Concurrency capped to one node; all state volatile across deploys/crashes. Acceptable on the documented Render free tier for friend games; a wall for growth.
- **Fix:** Add `@socket.io/redis-adapter` + externalize rooms when scaling beyond one instance; document the constraint until then.
- **Effort:** L

---

### [PERF-002] Broadcast fan-out per `game:action`

- **Severity:** LOW
- **File:** `packages/server/src/index.ts:304` (`afterTransition`)
- **Category:** Perf-Net
- **Description:** Each applied action runs `afterTransition` → `broadcastRoomState` (1× `publicState` + 1 emit to the room channel) + `broadcastViews` (up to 4× `projectView` + 4 per-seat emits, plus 1× `projectSpectatorView` + 1 spectator-channel emit). Spectators already share a single channel emit (good). See cost model below.
- **Evidence:**
```ts
function afterTransition(room: Room) {
  broadcastRoomState(room)   // publicState() + 1 emit
  broadcastViews(room)       // up to 4 projectView() + 4 emits + 1 spectator emit
  ...
}
```
- **Impact:** ~5 projections + up to 6 emits per action per room. Fine at MVP scale; grows linearly with active rooms.
- **Fix:** Skip seats whose projected view is unchanged; hoist shared public fields so they're computed once per action rather than per seat.
- **Effort:** M

---

### [PERF-003] Repeated array copies in `projectView`

- **Severity:** LOW
- **File:** `packages/engine/src/match.ts:540`
- **Category:** Perf-CPU / Perf-Mem
- **Description:** Every projection `.slice()`s `bidHistory`, `announcements`, `handHistory`, and `yourHand` — and this runs up to 4× per action. `handHistory` grows to ~10 entries (each embedding announcements), so late-match projections copy the most.
- **Evidence:**
```ts
bidHistory: snap.bidHistory.slice(),
announcements: snap.announcements.slice(),
handHistory: snap.handHistory.slice(),   // ×4 per action
```
- **Impact:** Minor GC pressure; immeasurable at small scale.
- **Fix:** Freeze and share the immutable public arrays across seat projections; only `yourHand` + `yourPotentialAnnouncements` differ per seat.
- **Effort:** S

---

### [PERF-004] No `@fastify/compress` on REST responses

- **Severity:** LOW
- **File:** `packages/server/src/index.ts:140`
- **Category:** Perf-Net
- **Description:** Socket.IO `perMessageDeflate` is correctly configured (`index.ts:201`), but REST responses (notably the new `GET /rooms`, up to 20 `publicState` objects) are uncompressed. Payloads are small, so impact is negligible.
- **Evidence:** no `@fastify/compress` in `packages/server/package.json`.
- **Fix:** `app.register(import('@fastify/compress'), { global: true })` if REST payloads grow.
- **Effort:** XS

---

## CRITICAL FINDINGS — DETAIL

> No CRITICAL-severity issues exist, so this section expands the **three most dangerous** findings (the two HIGH integrity issues plus the seat-hijack vector).

### 1. SEC-001 — Forging the leaderboard

**Attack walkthrough**
1. Attacker signs up normally and obtains a valid Supabase session (anon key + JWT are public/in-browser by design).
2. Opens devtools and calls the same client path the app uses — no game required:
```js
await supabase.from('matches').insert({
  room_code: 'HACK01',
  seat_s_id: (await supabase.auth.getUser()).data.user.id, // their own uid in one seat
  seat_n_name: 'victim', seat_e_name: 'victim2', seat_w_name: 'bot',
  score_ns: 151, score_ew: 0, winner_team: 'NS',
  hand_count: 1, settings: {}, summary: {}, started_at: new Date().toISOString()
})
```
3. RLS `matches_insert_self` passes because `auth.uid() = seat_s_id`. Row is committed.
4. `public.leaderboard` (and Profile/Tablo stats) recompute from `matches` → attacker shows a perfect record. Repeat in a loop for arbitrary inflation.

**Proof of concept:** the single `insert` above, run in the site's console while logged in.

**Business impact:** Public leaderboard and all player stats are untrustworthy. There is no server-side record to reconcile against because the server never writes matches. Game-result integrity = broken.

---

### 2. SEC-002 — Stealing a tournament

**Attack walkthrough**
1. Attacker registers for a tournament and is placed as `player_a` (or `player_b`) in a `tournament_matches` row.
2. Regardless of the real game, they call:
```js
await supabase.from('tournament_matches')
  .update({ winner_id: myUid }).eq('id', myMatchId)
```
3. RLS `tmatches_update_player` permits it (`auth.uid() = player_a_id`, and `winner_id = player_a_id` satisfies the `with check`).
4. The `propagate_tournament_winner` trigger marks the match finished and writes the attacker into the next round's slot — and, on the final round, sets `tournaments.winner_id` to the attacker.

**Proof of concept:** the single `update` above with the attacker's own match id.

**Business impact:** Any participant can advance themselves to victory. Brackets are meaningless; a "champion" badge can be self-assigned.

---

### 3. SEC-004 — Guest seat takeover

**Attack walkthrough**
1. Two guests share a room link. Guest A's `playerId` (localStorage UUID) is sent in every `room:join`/`game:action` payload and is observable to anyone who can see A's network traffic or device.
2. Attacker connects a socket and emits:
```js
socket.emit('room:join', { code:'AB12CD', playerId: VICTIM_UUID, nickname:'me' })
```
3. Server `findSeatByPlayerId` matches the victim's seat and re-binds the new socket to it (`index.ts:498-510`); `setConnected(true)`.
4. The attacker now controls the victim's seat and hand-view for that game.

**Proof of concept:** the `room:join` emit above with a known guest UUID.

**Business impact:** Mid-game hijack of a guest seat (see their `game:view`, play their cards). Bounded to guests and requires knowing/observing the UUID, so real-world risk is moderate — but the trust model (raw client string = identity) is the root cause.

---

## SUPABASE AUDIT

### RLS Status

| Table / object | RLS | Policies | Verdict |
|---|---|---|---|
| `public.profiles` | ✅ enabled | select(all), insert(self), update(self) | **SAFE** |
| `public.matches` | ✅ enabled | select(all), **insert(self — any seat)** | **AT RISK** (SEC-001) |
| `public.match_events` | ✅ enabled | select(all), insert(authed-in-match) | SAFE (unused by client) |
| `public.tournaments` | ✅ enabled | select(all), insert/update/delete(creator) | SAFE |
| `public.tournament_registrations` | ✅ enabled | select(all), insert/delete(self, window-checked) | SAFE |
| `public.tournament_matches` | ✅ enabled | select(all), **update(either player → any winner)** | **AT RISK** (SEC-002) |
| `public.test_demo` | ✅ enabled | select(all), **insert(true — anon)** | **AT RISK** (SEC-003) |
| `public.leaderboard` (view) | n/a | select granted anon/auth | SAFE (read-only) |
| `public.tournament_listings` (view) | n/a | select granted anon/auth | SAFE (read-only) |

`SECURITY DEFINER` functions (`handle_new_user`, `propagate_tournament_winner`, `set_updated_at`) all set `search_path = public` — good (no search-path hijack). Note `propagate_tournament_winner` is only as trustworthy as who can set `winner_id` → see SEC-002.

### Key Usage Audit

- **Where is `SUPABASE_SERVICE_ROLE_KEY` used?** Only to build `supabaseAdmin` (`server/src/supabase.ts:24`), which is used for exactly one thing: the **fallback** network call `supabaseAdmin.auth.getUser(token)` (`supabase.ts:71`) when `SUPABASE_JWT_SECRET` is unset. With `JWT_SECRET` present (it is, in `.env`), the service-role client is effectively unused. **It should instead be carrying the server-side match/tournament writes** that fix SEC-001/SEC-002.
- **Should any of those calls use ANON_KEY instead?** `auth.getUser(token)` does not require the service role — the anon key works. The service role is currently *over-privileged for what it does* and *under-used for what it should do*. Recommendation: keep the service-role client, and move match/bracket persistence onto it (server-authoritative writes).
- **Local vs network JWT verification:** `verifyAccessToken` (`supabase.ts:48`) uses **local HS256 verification via `jose`** when `SUPABASE_JWT_SECRET` is set — **zero network round-trips per connection**. This is already the recommended pattern (see below). Cost per connection ≈ a single in-process HMAC verify (microseconds).
- **Is `SUPABASE_ANON_KEY` referenced in `packages/server/`?** It is present in `.env`/`.env.example` but **never read** by server code. Remove it to avoid implying the server needs it.

### Token Lifecycle

- **Expiry during an active game:** Nothing breaks. `socket.data.user` is cached at handshake (`index.ts:421`) and the authed `playerId` (the verified uid) is stable, so gameplay continues even after the underlying JWT expires. The server does **not** re-check expiry on `game:action`.
- **Refresh mechanism:** Supabase auto-refreshes the browser token (`client/src/lib/supabase.ts:22`, `autoRefreshToken:true`). The server exposes an `auth:refresh` socket event, **but the client never emits it** — `auth.ts:75` updates the store only. So a long-lived socket runs on its original handshake identity until it disconnects. On socket.io auto-reconnect, `store/game.ts connect()`'s `auth` callback re-reads the current session token, so reconnects *do* re-verify.
- **Exact failure mode if a token fully expires and refresh fails, then the socket reconnects:** the auth callback supplies an empty/expired token → `verifyAccessToken` returns null → `socket.data.user = null` → on the next `room:join` the user is treated as a **guest** and `playerId` falls back to the client-supplied value, which for a previously-authed user is their uid string (still works) but is no longer server-verified. Practically rare; documented for completeness (relates to SEC-007).

---

## PERFORMANCE ANALYSIS

### Broadcast Cost Model

For a single `game:action` (via `afterTransition`, `index.ts:304`):
- **`room:state` broadcasts:** **1** (`broadcastRoomState` → one emit to the `room:<code>` channel; `publicState()` called once).
- **`game:view` emits:** up to **5** — one per occupied seat (max 4) **plus** one to the shared `spectators:<code>` channel (regardless of spectator count).
- **`projectView()` calls:** up to **4** (one per occupied seat) **plus 1** `projectSpectatorView()` = **5 projections**.
- **At 50 concurrent games × 3 spectators each, per action in one active room:** 1 `room:state` + 4 seat `game:view` + 1 spectator-channel `game:view` = **6 emits**, **5 projections**. The 3 spectators receive via the single channel emit (not 3 separate emits). Across all 50 rooms the *aggregate* depends on how many act simultaneously; only the acting room emits per its own action. Steady-state load is dominated by trick cadence (~one action every few seconds per room), so ~50 rooms ≈ a few hundred emits/sec peak — comfortably within one Node instance.

### Memory Growth Model (single room, full match)

- **`handHistory`:** +1 `LastHandResult` per finished hand. A game to 151 tens runs ~6–10 hands → **~10 entries**. Each embeds `cardPoints/announcementPoints/belotPoints/awardedRaw/awardedTens` (small numeric objects) + an `announcements` array (usually 0–4 small objects). Estimate **~300–600 B/entry → ~3–6 KB** total.
- **`completedTricks`:** **resets every hand** (`startNewHand` sets `[]`, `match.ts:105`); max **8** tricks × 4 cards while a hand is in progress. Does **not** accumulate across hands.
- **`bidHistory`:** **resets every hand** (`match.ts:101`); typically 4–12 entries.
- **`GameSnapshot` peak size:** 4 hands (≤8 cards each, shrinking) + current 8-trick buffer + ~10-entry handHistory + scalars ≈ **~8–15 KB** at end of match. Per-room overhead adds the `Room` wrapper, 4 timer handles, and the `spectators` Map. Negligible per room; the scaling risk is **room count**, not per-room size (see SEC-006/PERF-001).

### Timer Leak Analysis

Four timers per room: `turnTimer`, `botTimer`, `trickResolveTimer`, `emptyTimer`.
- **Guaranteed clear on deletion?** ✅ Yes. The only deletion path is `scheduleEmptyTimer`'s callback (`index.ts:237-245`), which calls `clearTimer` + `clearBotTimer` + `clearTrickResolveTimer` before `rooms.delete`. The `emptyTimer` itself has just fired (self-clearing).
- **`scheduleEmptyTimer` fires after the room was already deleted?** Not observed: deletion only happens *inside* that same timer's callback, and it re-checks `noOccupantsConnected(room)` before deleting; `cancelEmptyTimer` runs on every join/spectate. The `if (room.emptyTimer) return` guard prevents stacking duplicates. **No double-delete path found.**
- **`clearTrickResolveTimer` before `afterTransition` recurses?** ✅ Yes. In the pending-trick branch (`index.ts:308-316`) all three timers are cleared *before* arming the new `trickResolveTimer`; its callback calls `resolveCurrentTrick` then re-enters `afterTransition`. No overlapping trick timers.
- **One nit:** the global `setInterval(processMatchmaking, …)` (`index.ts:407`) is `.unref()`'d and never cleared — correct for a process-lifetime loop, but it (and live timers) are **not drained on SIGTERM** (no graceful shutdown). Process exit reclaims them, so this is cosmetic for a stateless restart but means in-flight games are dropped abruptly.

### Supabase Network Cost

- **Is `verifyAccessToken` local or network?** **Local** when `SUPABASE_JWT_SECRET` is set (it is) — `jose.jwtVerify` HS256, no network. Network `getUser` is only the fallback when the secret is absent.
- **At 10 new connections/second:** with local verify, added handshake latency ≈ the cost of one HMAC verification per connection (**sub-millisecond**); no Supabase round-trip. With the network fallback it would add one `auth.getUser` RTT (~50–200 ms) per connection and a Supabase rate-limit dependency — avoid in production.
- **Reference implementation (already present and correct):**
```ts
// server/src/supabase.ts:50 — local verification, the recommended path
import * as jose from 'jose'
const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!)
const { payload } = await jose.jwtVerify(token, secret, { algorithms: ['HS256'] })
// payload.sub = user id; verified signature + exp with zero network cost
```
Keep `SUPABASE_JWT_SECRET` set in every environment so this fast path is always taken.

---

## MISSING HARDENING CHECKLIST

- ❌ Helmet / security headers (X-Frame-Options, CSP, HSTS) — not configured (Fastify, no `@fastify/helmet`).
- ⚠️ `@fastify/rate-limit` on POST /rooms and REST — **not** used; a hand-rolled `makeIpLimiter` covers `/rooms` create+lookup (`index.ts:107-108`). Functional but not the plugin.
- ✅ Socket.IO event rate limiting beyond emote — per-socket sliding window for `game:action` (20/2s) and join/spectate/auth (5/10s) (`index.ts:414-417,667`); emote 1500 ms (`index.ts:566`).
- ❌ `@fastify/compress` for REST responses — absent (PERF-004).
- ✅ Socket.IO `perMessageDeflate` compression — configured (`index.ts:201`).
- ✅ Request body size cap — explicit `bodyLimit: 64*1024` (`index.ts:133`).
- ⚠️ Env var validation on startup — partial: `isSupabaseConfigured` warns and degrades to guest mode (`supabase.ts:30`) but does **not** fail fast; no validation of PORT/CORS.
- ❌ Graceful shutdown (drain timers before exit) — none (no SIGTERM/SIGINT handler).
- ⚠️ Structured error logging without stack traces in responses — responses return only short error strings (good); pino logger configured (`index.ts:134`); no evidence of stack traces leaking to clients, but no explicit prod error serializer.
- ⚠️ CORS `allowedHeaders` whitelist — origins are explicitly whitelisted and wildcard-rejected (`index.ts:55-69`) but `allowedHeaders`/`methods` are left to defaults.
- ✅ Input sanitization on nickname before broadcast — `sanitizeNickname` strips HTML + control chars, clips to 20 (`index.ts:74-80`).
- ✅ Crypto-random bot IDs — `randomBytes(6)` (`room.ts:156`); guest IDs `crypto.randomUUID()` (`identity.ts:23`).
- ✅ Crypto-random game seed — `randomBytes(4).readUInt32BE(0)` (`room.ts:180`). (`getRandomValues` not used, but `node:crypto.randomBytes` is equivalent server-side.)
- ❌ JWT expiry check on every socket event — only at handshake; not re-checked (SEC-007).
- ⚠️ Room count cap per IP or per user — per-IP REST cap only; no global/per-user cap, matchmaking bypasses it (SEC-006).
- ❌ Spectator cap per room — none (SEC-005).
- ✅ `handHistory` size cap in GameSnapshot — implicitly bounded by match length (~10); resets per match. Acceptable.
- ✅ Supabase RLS on all tables — enabled on every table; **but** two policies are too permissive (SEC-001/002) and `test_demo` is open (SEC-003).
- ✅ Supabase migrations directory with versioned SQL — present under `supabase/migrations/`.
- ⚠️ Match result persistence — the comment in `server/src/supabase.ts:12` says the server "writes match history," but it **does not**; the **client** writes via `matchPersist.ts` (root cause of SEC-001). Comment is stale.
- ✅ `.env` in `.gitignore` — yes; verified untracked (SEC-010).
- ✅ `SERVICE_ROLE_KEY` never logged or returned — not referenced in any log/response; only used to construct the client.

Legend: ✅ present · ❌ missing · ⚠️ partial.

---

## PRIORITIZED ACTION PLAN

| Priority | ID | Issue | Effort | Fix In |
|---|---|---|---|---|
| **P0 — Do now** | SEC-003 | Drop public-writable `test_demo` table | XS | new migration |
| **P0 — Do now** | SEC-001 | Move match persistence server-side; revoke client `matches` INSERT | L | server + migration |
| **P0 — Do now** | SEC-002 | Server-only tournament winner; revoke client `tournament_matches` UPDATE | M | server + migration |
| **P1 — Before public users** | SEC-005 | Spectator cap per room | S | `index.ts` |
| **P1 — Before public users** | SEC-006 | Global room ceiling + per-user cap | M | `index.ts` |
| **P1 — Before public users** | SEC-004 | HMAC-signed guest session tokens | M | server + client |
| **P2 — Before launch** | SEC-008 | Host-gate `room:start` / `room:addBot` | XS | `index.ts` |
| **P2 — Before launch** | SEC-007 | Forward token refresh to socket; periodic re-verify | S | client + server |
| **P2 — Before launch** | — | Helmet headers + graceful shutdown + env fail-fast | S | `index.ts` |
| **P2 — Before launch** | — | Remove unused server `SUPABASE_ANON_KEY`; fix stale persistence comment | XS | `.env`, `supabase.ts` |
| **P3 — Nice to have** | PERF-002/003 | Trim per-seat projection cost / skip unchanged views | M | engine + server |
| **P3 — Nice to have** | PERF-001 | Redis adapter for horizontal scale | L | server infra |
| **P3 — Nice to have** | PERF-004 | `@fastify/compress` for REST | XS | `index.ts` |

---

## QUICK WINS (under 30 min each)

Fixes that are **Effort XS/S AND Severity HIGH/CRITICAL**, or trivially high-value:

1. **SEC-003 (XS, MEDIUM→do-now):** `drop table if exists public.test_demo cascade;` and delete the migration. One line removes an anonymous open-write table.
2. **SEC-001 RLS half (S):** as an immediate stop-gap before the full server-write refactor, `revoke insert on public.matches from authenticated;` + drop `matches_insert_self`. This blocks forgery now (it disables client persistence until the server path lands — accept the gap or land the server insert in the same change).
3. **SEC-002 RLS half (S):** `drop policy tmatches_update_player; revoke update on public.tournament_matches from authenticated;` — stops bracket self-promotion immediately.
4. **SEC-008 (XS):** add `if (room.hostId !== playerId) return cb({ok:false,error:'only host'})` to `room:start` and `room:addBot`.
5. **SEC-005 (S):** add a `MAX_SPECTATORS` guard in `room:spectate`.

(SEC-001/002 are HIGH; their *RLS-revoke* halves are quick wins, but the complete fix — server-side authoritative writes — is L/M and should follow immediately so persistence isn't simply disabled.)

---

*End of audit report.*
