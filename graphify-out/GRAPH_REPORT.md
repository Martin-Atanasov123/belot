# Graph Report - belot  (2026-05-26)

## Corpus Check
- 111 files · ~95,816 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1325 nodes · 2013 edges · 87 communities (80 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7a6817a7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 86|Community 86]]

## God Nodes (most connected - your core abstractions)
1. `useT()` - 65 edges
2. `useGame` - 23 edges
3. `useAuth` - 22 edges
4. `Monogram()` - 18 edges
5. `compilerOptions` - 17 edges
6. `TIER A — ATMOSPHERE SCREENS` - 17 edges
7. `afterTransition()` - 16 edges
8. `Flourish()` - 15 edges
9. `seat` - 15 edges
10. `Seat` - 15 edges

## Surprising Connections (you probably didn't know these)
- `OAuthDivider()` --calls--> `useT()`  [EXTRACTED]
  packages/client/src/routes/AuthPages.tsx → packages/client/src/i18n/index.ts
- `OAuthButtons()` --calls--> `useT()`  [EXTRACTED]
  packages/client/src/routes/AuthPages.tsx → packages/client/src/i18n/index.ts
- `NotFound()` --calls--> `useT()`  [EXTRACTED]
  packages/client/src/routes/Profile.tsx → packages/client/src/i18n/index.ts
- `SignUpCTA()` --calls--> `useT()`  [EXTRACTED]
  packages/client/src/routes/Settings.tsx → packages/client/src/i18n/index.ts
- `NotificationsTab()` --calls--> `useT()`  [EXTRACTED]
  packages/client/src/routes/Settings.tsx → packages/client/src/i18n/index.ts

## Communities (87 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (38): BracketSize, buildRound1Matches(), isValidBracketSize(), matchesInRound(), planRound1(), roundCount(), roundLabel(), rounds (+30 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (48): Browser Automation with playwright-cli, Browser Sessions, code:bash (# open new browser), code:bash (playwright-cli console), code:bash (playwright-cli --raw eval "JSON.stringify(performance.timing), code:bash (playwright-cli list --json), code:bash (# Use specific browser when creating session), code:bash (> playwright-cli goto https://example.com) (+40 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (30): BiddingPanel(), ORDER, SUIT_GLYPH, SUIT_RED, Anchor, EMOTES, FloatingReactions(), Pos (+22 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (38): allowAccountDelete, ALLOWED_REACTIONS, allowRoomCreate, allowRoomLookup, app, body, checkRateLimit(), code (+30 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (42): code:powershell (& (Get-Content graphify-out\.graphify_python) -c "), code:powershell (@'), code:powershell (@'), code:powershell (@'), code:powershell (New-Item -ItemType Directory -Force -Path graphify-out | Out), code:powershell (@'), code:powershell (@'), code:powershell (@') (+34 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (40): 10. ЧАКАЛНЯ НА СТАЯ ( /staya/:id ), 11. РЕЗУЛТАТ НА РЪКА ( overlay ), 12. КРАЙ НА МАЧ — ПОБЕДА ( /game/:id/end ), 13. ПРОФИЛ ( /profil/:username ), 14. ТУРНИРИ ( /turniri ), 15. ТУРНИР ДЕТАЙЛ ( /turniri/:id ), 16. НАСТРОЙКИ ( /nastroyki ), 17. НАДДАВАНЕ ( /game/:id — bidding phase ) (+32 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (32): deleteAccount(), RoomListing, holdsBelotPair(), applyBid(), BiddingState, BidInput, bidLegal(), startBidding() (+24 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (36): code:block1 (/graphify                                             # full), code:powershell (@'), code:powershell (@'), code:powershell (if (-not (Test-Path graphify-out\.graphify_extract.json)) {), code:powershell (@'), code:powershell (@'), code:powershell (@'), code:powershell (@') (+28 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (35): 1. Name Browser Sessions Semantically, 2. Always Clean Up, 3. Delete Stale Browser Data, A/B Testing Sessions, Attach by channel name, Attach via browser extension, Attach via CDP endpoint, Attaching to a Running Browser (+27 more)

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (33): 1.1 Prerequisite: workspace, 1.2 Prerequisite: seed test, 1.3 Explore the app, 1.4 Write the spec file, 1. Planning, 2.1 Inputs, 2.2 Generate one scenario, 2.3 Generate multiple scenarios (+25 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (26): finalizeHand(), resolveTrick(), HandInputs, HandOutcome, HandResult, scoreHand(), toTens(), ActionSchema (+18 more)

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (16): AuthState, bootstrapAuth(), Profile, useAuth, ForgotPassword(), Login(), OAuthButtons(), OAuthDivider() (+8 more)

### Community 12 - "Community 12"
Cohesion: 0.10
Nodes (25): bestOf(), CARRE_POINTS, CarreCandidate, collectTeam(), compareSequence(), findCarresInHand(), findSequencesInHand(), resolveAnnouncements() (+17 more)

### Community 13 - "Community 13"
Cohesion: 0.07
Nodes (26): Broadcast Cost Model, code:block1 (grep: "Math.random"           → non-crypto randomness), code:block2 (grep: "broadcastViews\|broadcastRoomState"  → broadcast freq), code:block3 (### [SEVERITY-NNN] Title), code:block4 (- **Effort:** XS | S | M | L | XL), CRITICAL FINDINGS — DETAIL, FINDINGS, IMPORTANT INSTRUCTIONS (+18 more)

### Community 14 - "Community 14"
Cohesion: 0.07
Nodes (26): Clipboard, code:bash (playwright-cli run-code "async page => {), code:bash (# Get page title), code:bash (# Execute JavaScript and return result), code:bash (# Try-catch in run-code), code:bash (# Login and save state), code:bash (playwright-cli run-code --filename=./my-script.js), code:bash (# Grant geolocation permission and set location) (+18 more)

### Community 15 - "Community 15"
Cohesion: 0.13
Nodes (18): computeStats(), fetchAllTime(), fetchLeaderboard(), fetchProfileByUsername(), fetchProfileMatches(), fetchWindow(), LeaderboardRow, LeaderboardScope (+10 more)

### Community 16 - "Community 16"
Cohesion: 0.07
Nodes (26): dependencies, @belot/shared, framer-motion, react, react-dom, react-router-dom, socket.io-client, @supabase/supabase-js (+18 more)

### Community 17 - "Community 17"
Cohesion: 0.08
Nodes (25): Anti-cheat, Backend on Render, Bots, code:block1 (packages/), code:bash (git clone <this-repo>), code:bash (cd packages/server), code:bash (cd packages/client), code:bash (cd packages/engine) (+17 more)

### Community 18 - "Community 18"
Cohesion: 0.13
Nodes (25): advanceHand(), apply(), autoPickOnTimeout(), hasPendingTrick(), isError(), newMatch(), applyAction(), autoPlay() (+17 more)

### Community 19 - "Community 19"
Cohesion: 0.08
Nodes (24): dependencies, @belot/engine, @belot/shared, dotenv, fastify, @fastify/cors, jose, nanoid (+16 more)

### Community 20 - "Community 20"
Cohesion: 0.10
Nodes (22): broadcastRoomState(), addSpectator(), botAction(), botVoteCount(), botVoteThreshold(), decideBotBid(), everyoneConnected(), findSeatByPlayerId() (+14 more)

### Community 21 - "Community 21"
Cohesion: 0.12
Nodes (11): createRoom(), getNickname(), getPlayerIdFor(), readMap(), setNickname(), writeMap(), useTurnNotifier(), Landing() (+3 more)

### Community 22 - "Community 22"
Cohesion: 0.09
Nodes (22): 1. Project shape, 2.10 Match end, 2.1 Cards, 2.2 Deal, 2.3 Bidding (Наддаване), 2.4 Card values (cardPoints), 2.5 Card strength (cardStrength), 2.6 Contracts (+14 more)

### Community 23 - "Community 23"
Cohesion: 0.09
Nodes (22): 1. Start Tracing Before the Problem, 2. Clean Up Old Traces, Analyzing Performance, Basic Usage, Best Practices, Capturing Evidence, code:bash (# Start trace recording), code:bash (playwright-cli tracing-start) (+14 more)

### Community 24 - "Community 24"
Cohesion: 0.10
Nodes (19): devDependencies, eslint, prettier, tsup, tsx, @types/node, typescript, vitest (+11 more)

### Community 25 - "Community 25"
Cohesion: 0.13
Nodes (12): enableTurnAlerts(), NOTIF_KEYS, notificationPermission(), readNotifPref(), writeNotifPref(), NotificationsTab(), PrivacyTab(), SignUpCTA() (+4 more)

### Community 26 - "Community 26"
Cohesion: 0.11
Nodes (17): compilerOptions, declaration, esModuleInterop, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution (+9 more)

### Community 27 - "Community 27"
Cohesion: 0.13
Nodes (15): basePointsForContract(), cardPoints(), PLAIN_POINTS, PLAIN_STRENGTH, PLAIN_SUIT_ORDER, SEQUENCE_RANK_ORDER, sortHandForDisplay(), suitDisplayOrder() (+7 more)

### Community 28 - "Community 28"
Cohesion: 0.22
Nodes (14): currentTrickWinnerIndex(), currentWinningStrength(), isLegalPlay(), isPartnerCurrentlyWinning(), legalMoves(), trickHasTrump(), trickWinner(), applyPlayPhase() (+6 more)

### Community 29 - "Community 29"
Cohesion: 0.15
Nodes (9): JoinForm(), Lobby(), Pos, RulesPanel(), SEAT_TO_POS, CornerOrnament(), Flourish(), Monogram() (+1 more)

### Community 30 - "Community 30"
Cohesion: 0.12
Nodes (17): Advanced: Multiple Cookies or Custom Options, Clear All Cookies, code:bash (playwright-cli cookie-clear), code:bash (playwright-cli run-code "async page => {), code:bash (playwright-cli cookie-list), code:bash (playwright-cli cookie-list --domain=example.com), code:bash (playwright-cli cookie-list --path=/api), code:bash (playwright-cli cookie-get session_id) (+9 more)

### Community 31 - "Community 31"
Cohesion: 0.21
Nodes (13): buildDeck(), dealFirstFive(), dealFromSeed(), dealHands(), dealLastThree(), distribute(), Rng, shuffle() (+5 more)

### Community 32 - "Community 32"
Cohesion: 0.22
Nodes (9): LanguageToggle(), AuthSlot(), MobileAuth(), PublicNav(), useI18n, useT(), Premium(), Rules() (+1 more)

### Community 33 - "Community 33"
Cohesion: 0.13
Nodes (14): dependencies, @belot/shared, exports, main, name, scripts, build, test (+6 more)

### Community 34 - "Community 34"
Cohesion: 0.21
Nodes (9): classifyError(), ErrorScreen(), NotFoundScreen(), bg, MessageKey, en, DICTS, I18nState (+1 more)

### Community 35 - "Community 35"
Cohesion: 0.13
Nodes (14): Advanced Mocking with run-code, CLI Route Commands, code:bash (# Mock with custom status), code:block2 (**/api/users           - Exact path match), code:bash (playwright-cli run-code "async page => {), code:bash (playwright-cli run-code "async page => {), code:bash (playwright-cli run-code "async page => {), code:bash (playwright-cli run-code "async page => {) (+6 more)

### Community 36 - "Community 36"
Cohesion: 0.13
Nodes (15): Advanced: Multiple Operations, Clear All localStorage, code:bash (playwright-cli localstorage-list), code:bash (playwright-cli localstorage-get token), code:bash (playwright-cli localstorage-set theme dark), code:bash (playwright-cli localstorage-set user_settings '{"theme":"dar), code:bash (playwright-cli localstorage-delete token), code:bash (playwright-cli localstorage-clear) (+7 more)

### Community 37 - "Community 37"
Cohesion: 0.13
Nodes (14): 1. Use Semantic Locators, 2. Explore Before Recording, 3. Add Assertions Manually, Best Practices, Building a Test File, code:bash (# Start a session), code:typescript (import { test, expect } from '@playwright/test';), code:typescript (// Generated (good - semantic)) (+6 more)

### Community 38 - "Community 38"
Cohesion: 0.14
Nodes (14): code:block22 ($ git check-ignore packages/server/.env  → packages/server/.), code:ts (const rooms = new Map<string, Room>()           // index.ts:), code:ts (function afterTransition(room: Room) {), code:ts (bidHistory: snap.bidHistory.slice(),), code:sql (create policy "Allow all to insert test_demo"), code:sql (drop table if exists public.test_demo cascade;), FINDINGS, [PERF-001] Single-instance in-memory state — no horizontal scaling (+6 more)

### Community 39 - "Community 39"
Cohesion: 0.15
Nodes (12): code:block1 (packages/server/src/index.ts      ← Fastify + Socket.IO hand), code:block2 (### [SEVERITY] Заглавие на проблема), Security & Performance Audit Prompt — Белот Online, ЗАДАЧА, КОНТЕКСТ, ПРИОРИТИЗИРАН ACTION PLAN, СЕКЦИЯ 1 — CRITICAL SECURITY ISSUES, СЕКЦИЯ 2 — MEDIUM SECURITY ISSUES (+4 more)

### Community 40 - "Community 40"
Cohesion: 0.15
Nodes (12): dependencies, zod, exports, main, name, scripts, build, test (+4 more)

### Community 41 - "Community 41"
Cohesion: 0.17
Nodes (11): compilerOptions, jsx, lib, module, moduleResolution, noEmit, paths, verbatimModuleSyntax (+3 more)

### Community 43 - "Community 43"
Cohesion: 0.17
Nodes (11): 1. Use Descriptive Filenames, 2. Record entire hero scripts., Basic Recording, Best Practices, code:bash (# Open browser first), code:bash (# Include context in filename), code:js (async page => {), Limitations (+3 more)

### Community 44 - "Community 44"
Cohesion: 0.18
Nodes (11): Clear sessionStorage, code:bash (playwright-cli sessionstorage-list), code:bash (playwright-cli sessionstorage-get form_data), code:bash (playwright-cli sessionstorage-set step 3), code:bash (playwright-cli sessionstorage-delete step), code:bash (playwright-cli sessionstorage-clear), Delete Single Item, Get Single Value (+3 more)

### Community 45 - "Community 45"
Cohesion: 0.42
Nodes (11): afterTransition(), armTurnTimer(), ensureRoomCapacity(), maybeScheduleBotTurn(), scheduleEmptyTimer(), shutdown(), clearBotTimer(), clearTimer() (+3 more)

### Community 46 - "Community 46"
Cohesion: 0.18
Nodes (7): CardView(), PIP_LAYOUTS, PipPos, RED, SUIT_GLYPH, SUIT_NAME_BG, Card

### Community 47 - "Community 47"
Cohesion: 0.20
Nodes (9): Key Usage Audit, MISSING HARDENING CHECKLIST, PRIORITIZED ACTION PLAN, QUICK WINS (under 30 min each), RLS Status, Security & Performance Audit — Белот Online, SUMMARY SCORECARD, SUPABASE AUDIT (+1 more)

### Community 48 - "Community 48"
Cohesion: 0.24
Nodes (5): o, r1Matchups(), roundCount(), roundLabel(), standardSeedOrder()

### Community 49 - "Community 49"
Cohesion: 0.24
Nodes (9): isTrump(), PLAIN_STRENGTH, PLAIN_SUIT_ORDER, sortHandForDisplay(), strength(), suitDisplayOrder(), TRUMP_STRENGTH, Rank (+1 more)

### Community 50 - "Community 50"
Cohesion: 0.22
Nodes (8): compilerOptions, module, moduleResolution, outDir, rootDir, verbatimModuleSyntax, extends, include

### Community 51 - "Community 51"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, paths, rootDir, extends, include, @belot/shared

### Community 52 - "Community 52"
Cohesion: 0.25
Nodes (7): Authentication State Reuse, code:bash (# Step 1: Login and save state), code:bash (# Set up authentication state), Common Patterns, Save and Restore Roundtrip, Security Notes, Storage Management

### Community 53 - "Community 53"
Cohesion: 0.29
Nodes (7): 1. SEC-001 — Forging the leaderboard, 2. SEC-002 — Stealing a tournament, 3. SEC-004 — Guest seat takeover, code:js (await supabase.from('matches').insert({), code:js (await supabase.from('tournament_matches')), code:js (socket.emit('room:join', { code:'AB12CD', playerId: VICTIM_U), CRITICAL FINDINGS — DETAIL

### Community 54 - "Community 54"
Cohesion: 0.29
Nodes (7): code:bash (# Save to auto-generated filename (storage-state-{timestamp}), code:bash (# Load storage state from file), code:json ({), Restore Storage State, Save Storage State, Storage State, Storage State File Format

### Community 55 - "Community 55"
Cohesion: 0.33
Nodes (4): check(), log(), makeClient(), io

### Community 56 - "Community 56"
Cohesion: 0.33
Nodes (6): Broadcast Cost Model, code:ts (// server/src/supabase.ts:50 — local verification, the recom), Memory Growth Model (single room, full match), PERFORMANCE ANALYSIS, Supabase Network Cost, Timer Leak Analysis

### Community 57 - "Community 57"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 58 - "Community 58"
Cohesion: 0.33
Nodes (5): arrowParens, printWidth, semi, singleQuote, trailingComma

### Community 59 - "Community 59"
Cohesion: 0.33
Nodes (6): armQuickFillTimer(), findOrCreateQuickRoom(), roomCode, anyHumanConnected(), createRoom(), findFreeSeat()

### Community 60 - "Community 60"
Cohesion: 0.40
Nodes (5): code:ts (// matchPersist.ts:22 — runs in the browser, fully attacker-), code:sql (-- 20260519_matches_insert_policy.sql:18), code:ts (// SERVER (packages/server/src) — persist authoritatively on), code:sql (-- Then revoke the client write path entirely:), [SEC-001] Client-authoritative match persistence enables leaderboard / stat forgery

### Community 61 - "Community 61"
Cohesion: 0.40
Nodes (4): mcpServers, supabase, type, url

### Community 62 - "Community 62"
Cohesion: 0.40
Nodes (4): enableAllProjectMcpServers, enabledMcpjsonServers, permissions, allow

### Community 63 - "Community 63"
Cohesion: 0.40
Nodes (4): copy, network, SHELL, url

### Community 64 - "Community 64"
Cohesion: 0.40
Nodes (4): code:bash (# Run all tests), code:bash (# Run the test), Debugging Playwright Tests, Running Playwright Tests

### Community 65 - "Community 65"
Cohesion: 0.40
Nodes (5): code:bash (playwright-cli run-code "async page => {), code:bash (playwright-cli run-code "async page => {), Delete Database, IndexedDB, List Databases

### Community 66 - "Community 66"
Cohesion: 0.40
Nodes (4): name, organization_id, organization_slug, ref

### Community 67 - "Community 67"
Cohesion: 0.50
Nodes (4): code:ts (// index.ts:492 — guests fall through to whatever the client), code:ts (// identity.ts:23 — guest secret lives in localStorage, trav), code:ts (import { createHmac, randomBytes } from 'node:crypto'), [SEC-004] Guest seat hijack via leaked `playerId`

### Community 68 - "Community 68"
Cohesion: 0.50
Nodes (4): code:ts (// index.ts:421 — captured once, never refreshed for the soc), code:ts (// auth.ts:75 — refresh updates the store but never notifies), code:ts (supabase.auth.onAuthStateChange((_e, session) => {), [SEC-007] Socket identity is never re-verified after the handshake

### Community 69 - "Community 69"
Cohesion: 0.50
Nodes (4): code:sql (-- phase_d:147), code:sql (drop policy if exists tmatches_update_player on public.tourn), code:ts (// server, after persisting the match: link + report winner ), [SEC-002] Tournament results can be falsified by either participant

### Community 71 - "Community 71"
Cohesion: 0.50
Nodes (3): code:bash (playwright-cli snapshot), Examples, Inspecting Element Attributes

### Community 72 - "Community 72"
Cohesion: 0.67
Nodes (4): fillBotsAndStart(), addBot(), allSeatsFilled(), startGame()

### Community 73 - "Community 73"
Cohesion: 0.50
Nodes (4): broadcastViews(), projectSpectatorView(), snapshotForSeat(), snapshotForSpectator()

### Community 74 - "Community 74"
Cohesion: 0.67
Nodes (3): code:ts (// room.ts:215), code:ts (const MAX_SPECTATORS = 50), [SEC-005] No spectator cap — memory + broadcast amplification DoS

### Community 75 - "Community 75"
Cohesion: 0.67
Nodes (3): code:ts (const allowRoomCreate = makeIpLimiter(10, 10 * 60_000) // on), code:ts (const MAX_ROOMS = 5000), [SEC-006] No global room ceiling; matchmaking creates rooms outside the per-IP limit

### Community 76 - "Community 76"
Cohesion: 0.67
Nodes (3): code:ts (// index.ts:541), code:ts (if (room.hostId !== playerId) return cb({ ok:false, error:'o), [SEC-008] Any seated player (not just host) can start the game or add bots

## Knowledge Gaps
- **614 isolated node(s):** `type`, `url`, `semi`, `singleQuote`, `trailingComma` (+609 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `seat` connect `Community 6` to `Community 2`, `Community 3`, `Community 10`, `Community 12`, `Community 18`, `Community 29`, `Community 31`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Why does `useT()` connect `Community 32` to `Community 0`, `Community 2`, `Community 34`, `Community 42`, `Community 11`, `Community 15`, `Community 21`, `Community 25`, `Community 29`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `Seat` connect `Community 6` to `Community 2`, `Community 10`, `Community 12`, `Community 18`, `Community 29`, `Community 31`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `type`, `url`, `semi` to the rest of the system?**
  _614 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06787330316742081 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.061170212765957445 - nodes in this community are weakly interconnected._