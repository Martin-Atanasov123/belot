You are performing a full security and performance audit of this codebase. Do not ask for clarification — start immediately.

## YOUR MISSION

Search every file in this repo and produce a complete audit report saved to `audit-report.md`. Do not summarize — be exhaustive and specific.

## STEP 1 — MAP THE CODEBASE

Run these searches before writing anything:

1. Glob `**/*.ts` and `**/*.tsx` — exclude `node_modules/`, `dist/`, `.d.ts` files
2. Read every file under `packages/server/src/`
3. Read every file under `packages/engine/src/`
4. Read every file under `packages/client/src/`
5. Read every file under `packages/shared/src/`
6. Read `packages/server/.env` and `packages/server/.env.example`
7. Read all `package.json` files (root + each workspace)
8. Read `packages/client/vite.config.ts`
9. Read `packages/server/tsup.config.ts`

## STEP 2 — SECURITY GREP PASS

Run ALL of the following greps and record every match with file + line:

```
grep: "Math.random"           → non-crypto randomness
grep: "console.log"           → debug leaks in production
grep: "process.env"           → env var usage — check for missing fallbacks
grep: "origin.*\*"            → CORS wildcard
grep: "credentials.*true"     → credentials with CORS
grep: "SERVICE_ROLE"          → service role key usage scope
grep: "any"                   → TypeScript `any` — potential type safety gaps
grep: "TODO|FIXME|HACK|XXX"   → unfinished security-relevant code
grep: "parseInt|parseFloat"   → unvalidated numeric parsing
grep: "JSON.parse"            → unguarded parse (no try/catch?)
grep: "eval\("               → eval usage
grep: "innerHTML"             → XSS vectors
grep: "dangerouslySetInner"   → React XSS
grep: "http://"               → non-TLS endpoints
grep: "0\.0\.0\.0"            → exposed host binding
grep: "socket\.data"          → socket data trust — verify all reads are typed
grep: "playerId"              → every place playerId is read from client input
grep: "hostId"                → every place hostId is trusted
grep: "nickname"              → every place nickname is accepted/emitted
grep: "\.safeParse\|\.parse"  → Zod validation coverage — find handlers WITHOUT it
grep: "setTimeout"            → timer leak candidates
grep: "clearTimeout"          → verify every setTimeout has a matching clear
grep: "rooms\.get\|rooms\.set\|rooms\.delete" → room lifecycle
grep: "supabaseAdmin"         → every usage of the privileged client
grep: "verifyAccessToken"     → every call site — is result always checked?
grep: "next()"                → Socket.IO middleware — auth bypass paths
grep: "return cb\({ ok: false" → error message content audit
grep: "import.meta.env"       → client-side env vars — check for secret exposure
```

## STEP 3 — PERFORMANCE GREP PASS

```
grep: "broadcastViews\|broadcastRoomState"  → broadcast frequency
grep: "projectView\|projectSpectatorView"   → view projection cost per action
grep: "for.*of.*seats\|forEach.*seat"       → O(n) seat iterations
grep: "Map<\|new Map"                       → in-memory collections (scale risk)
grep: "io\.to.*emit"                        → Socket.IO emit patterns
grep: "\.compress\|perMessageDeflate"       → compression config
grep: "@fastify/compress\|@fastify/rate"    → missing Fastify plugins
grep: "handHistory\|completedTricks"        → unbounded arrays in state
grep: "spread\|\.\.\."                      → immutable state copy cost
grep: "await supabase"                      → async Supabase calls (latency)
grep: "getUser\|auth\.get"                  → network round-trips on hot paths
```

## STEP 4 — WRITE THE REPORT

Save the full report to `audit-report.md` in the repo root.

Structure the report EXACTLY as follows:

---

# Security & Performance Audit — Белот Online
*Generated: [date]*

## SUMMARY SCORECARD

| Category | Issues Found | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| Authentication & Authorization | | | | | |
| Input Validation | | | | | |
| CORS & Transport | | | | | |
| Rate Limiting & DoS | | | | | |
| Data Leakage | | | | | |
| Cryptography | | | | | |
| Performance — CPU | | | | | |
| Performance — Memory | | | | | |
| Performance — Network | | | | | |
| Supabase Configuration | | | | | |
| Architecture Gaps | | | | | |

---

## FINDINGS

For EVERY finding use this exact format:

```
### [SEVERITY-NNN] Title

- **Severity:** CRITICAL | HIGH | MEDIUM | LOW | INFO
- **File:** `path/to/file.ts:LINE`
- **Category:** Auth | Input | CORS | DoS | Leak | Crypto | Perf-CPU | Perf-Mem | Perf-Net | Supabase | Architecture
- **Description:** What the issue is, explained precisely.
- **Evidence:** Paste the exact problematic code snippet (3-10 lines).
- **Impact:** What an attacker or the system can do because of this.
- **Fix:**
```typescript
// concrete corrected code — not pseudocode
```
- **Effort:** XS | S | M | L | XL
```

Number findings sequentially: SEC-001, SEC-002... for security; PERF-001... for performance.

---

## CRITICAL FINDINGS — DETAIL

Expand the 3 most dangerous security findings with:
- Full attack walkthrough (step by step what an attacker does)
- Proof of concept (what request/socket event triggers it)
- Business impact (data exposed, game integrity broken, DoS possible?)

---

## SUPABASE AUDIT

### RLS Status
- List every table that exists (check migrations or any .sql files)
- For each: is RLS enabled? Are policies defined?
- Verdict: SAFE | AT RISK | UNKNOWN

### Key Usage Audit
- Where is `SUPABASE_SERVICE_ROLE_KEY` used? Should any of those calls use `ANON_KEY` instead?
- Is JWT verification done via network call or local verification? Cost per connection?
- Is `SUPABASE_ANON_KEY` referenced anywhere in `packages/server/`? Should it be?

### Token Lifecycle
- What happens when a player's JWT expires during an active game?
- Is there a refresh mechanism? If not, describe the exact failure mode.

---

## PERFORMANCE ANALYSIS

### Broadcast Cost Model

Calculate the Socket.IO emit count for a single `game:action` event:
- How many `room:state` broadcasts?
- How many `game:view` emits?
- How many `projectView()` calls?
- At 50 concurrent games with 3 spectators each: total emits per action?

### Memory Growth Model

For a single room over a full match:
- `handHistory` — how many entries after 10 hands? What is the byte size?
- `completedTricks` — does it reset between hands or accumulate?
- `bidHistory` — same question
- Estimate total `GameSnapshot` object size after 10 hands

### Timer Leak Analysis

For each of the 4 timers per room (`turnTimer`, `emptyTimer`, `botTimer`, `trickResolveTimer`):
- Is there a guaranteed `clearTimeout` path on room deletion?
- Is there a path where `scheduleEmptyTimer` fires but the room was already deleted?
- Is `clearTrickResolveTimer` called before `afterTransition` recurses?

### Supabase Network Cost

For each `verifyAccessToken()` call:
- Is this a local JWT decode or a network request to Supabase?
- At 10 new connections/second: what is the latency added to handshake?
- Provide the code to verify Supabase JWTs locally using `jose` with `SUPABASE_JWT_SECRET`

---

## MISSING HARDENING CHECKLIST

Go through each item, mark ✅ present / ❌ missing / ⚠️ partial:

- [ ] Helmet / security headers (X-Frame-Options, CSP, HSTS)
- [ ] `@fastify/rate-limit` on POST /rooms and REST endpoints  
- [ ] Socket.IO event rate limiting (beyond emote 1500ms)
- [ ] `@fastify/compress` for REST responses
- [ ] Socket.IO `perMessageDeflate` compression
- [ ] Request body size cap (explicit, not default)
- [ ] Environment variable validation on startup (fail fast if missing)
- [ ] Graceful shutdown (drain timers before process exit)
- [ ] Structured error logging without stack traces in production responses
- [ ] CORS `allowedHeaders` whitelist
- [ ] Input sanitization on nickname before broadcast
- [ ] Crypto-random bot IDs (`crypto.randomUUID()` or `nanoid`)
- [ ] Crypto-random game seed (`crypto.getRandomValues`)
- [ ] JWT expiry check on every socket event (not just handshake)
- [ ] Room count cap per IP or per authenticated user
- [ ] Spectator cap per room
- [ ] `handHistory` size cap in GameSnapshot
- [ ] Supabase RLS on all tables
- [ ] Supabase migrations directory with versioned SQL
- [ ] Match result persistence (the supabase.ts comment says it writes — does it?)
- [ ] `.env` file in `.gitignore`
- [ ] `SERVICE_ROLE_KEY` never logged or returned in API responses

---

## PRIORITIZED ACTION PLAN

| Priority | ID | Issue | Effort | Fix In |
|---|---|---|---|---|
| P0 — Do now | | | | |
| P1 — Before any public users | | | | |
| P2 — Before launch | | | | |
| P3 — Nice to have | | | | |

---

## QUICK WINS (under 30 min each)

List every fix that is: Effort XS or S AND Severity HIGH or CRITICAL.
These should be done today.

---

*End of audit report.*

---

## IMPORTANT INSTRUCTIONS

- Do NOT skip any file. Read everything before writing the report.
- Do NOT write generic advice. Every finding must reference actual code from this repo.
- If a grep returns no matches, write "No instances found" — do not omit the check.
- If you find issues NOT covered by the grep list, add them.
- Save the final report with Write tool to `audit-report.md` in the repo root.
- After saving, print a one-paragraph executive summary to the terminal.
