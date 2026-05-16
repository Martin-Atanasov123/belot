# CLAUDE.md — Belot Online project notes

Authoritative reference for Claude when working on this codebase. The rules below are the **Bulgarian Belot** rules as documented at https://belot.bg/belot/rules/ (Casualino JSC). Whenever a game-logic question arises, this file wins over memory.

---

## 1. Project shape

Monorepo, npm workspaces.

```
packages/
  shared/   types + zod schemas shared across client/server
  engine/   pure TS rules + state machine, no IO, fully unit-tested
  server/   Fastify + Socket.IO authoritative game host
  client/   React + Vite + Tailwind + framer-motion
```

- Engine is pure and deterministic. No `Date.now()`, no IO. Randomness only via injected RNG (`mulberry32(seed)`).
- Server is authoritative. The client only renders state and sends intents. Never trust client claims about legality, scoring, or announcements.
- Anti-cheat: the server emits one `PlayerView` per seat with other seats' hands hidden (only counts). Never broadcast the full snapshot.

---

## 2. Game rules — Bulgarian Belot (canonical)

### 2.1 Cards

- 32-card deck (bridge deck with 2–6 removed): ranks `7 8 9 10 J Q K A`, suits `♣ ♦ ♥ ♠` (C/D/H/S).
- 4 players, two teams: **(0, 2) = NS** vs **(1, 3) = EW**. Partners sit opposite.
- Dealing direction: counter-clockwise. (Implementation uses `nextSeat = (s+1)%4` as the "next bidder" rotation; direction is convention only as long as partners stay opposite.)

### 2.2 Deal

- Deal happens in two rounds: **3 + 2** = 5 cards each.
- Bidding then opens.
- After bidding ends with a chosen contract, dealer deals the remaining **3** cards each → 8 cards total per player.
- First bidder = player to the right of the dealer (`nextSeat(dealer)` in our model).

### 2.3 Bidding (Наддаване)

Bid order (ascending strength):
```
PASS < C (Спатия) < D (Каро) < H (Купа) < S (Пика) < NT (Без коз) < AT (Всичко коз)
```
- Each player in turn: **PASS**, **BID** (higher than current), **CONTRA**, or **RECONTRA**.
- Only the opposing team may **CONTRA** the current bid. CONTRA doubles all points (including premiums and capot) for the team that wins the hand.
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
- A trump card always beats any non-trump card.

### 2.6 Contracts

| Contract | Trump suit | Card values | Notes |
|----------|------------|-------------|-------|
| C, D, H, S | named suit | trump for that suit, plain for others | standard "colour" contract |
| NT (Без коз) | none | every suit uses plain values | **no announcements allowed** (except last-10 and capot bonus). Final card points are **doubled** (the capot bonus is NOT doubled). |
| AT (Всичко коз) | every suit | every suit uses trump values | announcements allowed |

### 2.7 Play (Разиграване)

- Lead first trick: player to the right of the dealer.
- Each subsequent trick: led by previous trick's winner.
- Must follow suit if possible.
- In trump contracts (C/D/H/S, and AT where every suit is trump): if cannot follow suit, **must trump** if able. If a trump has already been played in this trick, **must over-trump** (надкозване) if possible — UNLESS your partner is currently winning the trick, in which case you may discard freely.
- In NT: never required to trump (there is no trump).
- 10-point bonus to the winner of the **last trick** (Последни 10).
- 90-point bonus for **capot** (all 8 tricks taken by one team).

### 2.8 Announcements (Анонси)

Declared by **playing your first card of the hand** (with or without the announcement card on the table; the act of playing your first card "declares" any combos you hold).

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
1. **Carrés outrank sequences.** If both teams have a carré, the higher-points carré wins (J=200 > 9=150 > rest=100).
2. Among sequences: **longer wins**. Same length → **higher top rank** wins.
3. Still tied → **trump-suit announcement** wins.
4. Still tied → team that announced **first** wins (in our model = lowest seat number among declarers, since all simultaneously declare on trick 1).

**Only the winning team's announcements score.** The losing side's combos are forfeit.

**Белот** (K + Q of the trump suit, held by one player) = +20 to that player's team. Played by playing both K and Q to the table; the bonus is awarded when the second of the pair is played by the same seat. Not available in NT.

**No announcements at all in NT.** Source: belot.bg — "При игра на „Без коз" играчите нямат право да обявяват притежаваните от тях комбинации."

If one card participates in both a карé and a sequence, the holder picks which combo to count. **Engine canonical AI choice: take the carré** (carrés are always higher-value); the sequence is then re-evaluated on the remaining cards (and dropped if it falls below 3 consecutive). See `scanHand` in `announcements.ts`.

### 2.9 Hand scoring & "inside / suspended"

After the 8th trick:
1. Sum trick points + 10 for last trick = `cardPoints` per team.
2. Add announcement points (only the winning team's).
3. Add Белот (+20) to the holder's team if completed.
4. If one team won all 8 tricks → +90 capot to them.
5. Apply NT doubling to **card points and announcements** (capot is NOT doubled). Belot doubling varies — we keep it un-doubled in NT (NT has no belot anyway).
6. Compare `bidderTotal` vs `defenderTotal`:
   - `bidder > defender` → **изкарана** (made): each team records its own points.
   - `bidder < defender` → **вкарана** (inside): defenders take **all** card points + all announcements + the capot (if any). Bidders score 0 (belot, if held, stays with the declarer).
   - `bidder == defender` → **висяща** (suspended): bidders' points are held in a "hung pool" and added to whoever wins the next hand. Defenders record their own points normally. If the next hand is also suspended, the pool accumulates.
7. Apply multiplier (×2 for CONTRA, ×4 for RECONTRA) to the final awarded values, **including all premiums and capot**.
8. Convert raw points → match score: **divide by 10, round to nearest integer**. The match-score column counts in "tens".
   - Suit trump and AT: standard half-up rounding (≤4 down, ≥5 up).
   - NT: rounding happens AFTER doubling.
   - Specific edge cases the source documents (we accept the simplified rule for MVP):
     - AT with both teams ending in 4-or-higher last digit → the team with FEWER points rounds up.
     - Suspended-point rounding: 15-or-16 hang on AT; 10-or-11 hang on trump-suit. (Not yet implemented; current code adds suspended to the next-hand winner verbatim, then re-rounds.)

### 2.10 Match end

- First team to **151+ tens** wins.
- If both cross 151 in the **same** hand: the team with more wins.
- If equal at ≥151: keep playing until one is strictly ahead.
- **"С капо не се излиза"** (cannot win on a capot alone): if you cross 151 only because of a capot bonus, an extra hand is played (all-pass redeals don't count). **Not yet implemented in MVP.**
- **Capot × contra is configurable.** `RoomSettings.capotDoubledByContra` — default `true` (the +90 capot is multiplied by contra/re-contra). Set `false` for the tournament variant where the capot bonus stays fixed at 90 even under contra/re-contra. Host can toggle from the lobby before the game starts. See `scoreHand` in `scoring.ts`.

---

## 3. Implementation map

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
| Authoritative server, rooms, sockets, bots | `packages/server/src/{index,room}.ts` |
| Per-seat PlayerView projection (anti-cheat) | `packages/engine/src/match.ts` → `projectView` |

---

## 4. Conventions

- **Pure engine.** No `Date`, no IO, no randomness outside `rng.ts`. Pass seed in, get deterministic state out. This keeps unit tests fast and replays bit-exact.
- **Reducer pattern.** `apply(snap, action): GameSnapshot | EngineError`. Server validates → applies → projects per seat → broadcasts.
- **PlayerView never leaks hidden info.** Other seats' cards become counts only; bid history and trick history are public.
- **i18n.** Client UI strings live in `packages/client/src/i18n/{bg,en}.ts`. Source-of-truth is the `MessageKey` union in `bg.ts`; `en.ts` must satisfy `Record<MessageKey, string>`. Server messages stay English (they're internal error codes).
- **Tests are scenarios, not implementations.** A scoring test should describe "AT, bidder wins capot, no contra → bidder gets X tens" — not the math of how X is computed.
- **No emojis in code or commits** unless the user explicitly asks.

---

## 5. Common pitfalls (notes-to-self)

- **The match-score column counts in TENS.** The raw card-pool max is 162 / 260 / 258 → divided by 10 that's ~16 / 26 / 26 per hand. A game to 151 typically takes 6–10 hands. If a single hand can end the match, scoring is wrong.
- **Equal hand totals = suspended (висящ), not inside.** Many simplified implementations treat ties as a bidder-loss; that's wrong for BG belote.
- **NT has no announcements.** Don't accidentally award terca/kvarta/carre/belot in a No-Trumps hand.
- **Capot bonus is never doubled by NT.** It IS multiplied by contra/recontra.
- **Belot is awarded on the SECOND K/Q-of-trump play by the same player.** Not when the player holds the pair, not when the first card is played.
- **Over-trump exemption when partner is winning.** Players are NOT required to over-trump a trick their partner is currently winning.
- **Carrés trump sequences.** A team with a carré beats any opponent sequence regardless of length.
- **Auto-play on timeout uses lowest-value legal card.** Same fallback the Easy bot uses.
- **Render free tier sleeps after 15 min.** The first request after sleep takes ~30 s. Acceptable for friend games; upgrade for always-on.

---

## 6. References

- Primary: https://belot.bg/belot/rules/ (Bulgarian; Casualino JSC)
- Project spec: `C:\Users\atana\.claude\plans\project-spec-belot-online-tender-duckling.md`
