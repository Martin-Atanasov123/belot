# Design System Prompt — Белот Online
### "Atmospheric Minimalism" — Full Redesign Brief

---

## CORE PHILOSOPHY

**One sentence:** The player must *feel* the atmosphere without ever *thinking* about it.

The design operates on a two-tier split. Every screen belongs to one tier:

| Tier | Context | Visual weight |
|---|---|---|
| **A — Atmosphere** | Landing, Lobby, Auth, Menus, Results, Victory | Rich. Ornate. Cinematic. |
| **B — Battlefield** | Active bidding, Active play, Timer, HUD | Ultra-clean. High contrast. Zero decoration. |

Decoration is a reward for idle moments. During active play, the UI disappears — only information remains.

---

## COLOR TOKENS

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

**Brass rule:** Brass is used ONLY for: active player indicator, selected card, interactable CTA, win state, tournament/ranked badge. Never for passive borders, dividers, or labels.

---

## TYPOGRAPHY

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

---

## NAVIGATION STRUCTURE

### Public Nav (unauthenticated)
```
[МОНОГРАМ / ЛОГОТИП]          [ПРАВИЛА]  [КЛАСАЦИЯ]  [PREMIUM]          [ВХОД]  [РЕГИСТРАЦИЯ]
```
- Transparent on landing hero, solid #0e251c on scroll (backdrop-blur)
- No brass borders on nav items — ash color, brass on hover only
- Mobile: hamburger → full-screen dark overlay menu

### App Nav (authenticated — lobby state)
```
[ЛОГОТИП]          [ИГРАЙ]  [ТУРНИРИ]  [КЛАСАЦИЯ]          [АВАТАР ▾]
```
- Avatar dropdown: Профил · Настройки · Изход
- Active route: brass underline (2px), not background highlight

### In-Game HUD (Tier B — gameplay only)
```
[← НАПУСНИ]     [НС: 47 · ИЗ: 63]     [СТАЯ: X4K9]     [⏱ 0:18]
```
- Minimal. No logo. No nav links.
- Scores in JetBrains Mono.
- Timer turns ember red below 10 seconds (no animation — just color change).
- "Напусни" requires confirm modal before exiting active game.

---

## SCREEN INVENTORY

### TIER A — ATMOSPHERE SCREENS

---

#### 1. LANDING PAGE ( / )
**Purpose:** First impression. Convert visitor to registered player.

**Structure:**
- **Hero section:** Full-viewport. Felt texture background. Monogram centered. Playfair headline (BG: "Четири играча. Една маса. Белот."). Brass CTA "Играй безплатно". Subline in smoke color. Corner SVG ornaments. Atmospheric ember glow top-right, brass glow bottom-left.
- **Feature strip:** 3 columns. Icons (SVG, brass). Short copy. No bullet points — prose only.
- **How it works:** 3-step numbered flow. Cream on felt. Flourish divider above and below.
- **Social proof:** Player count, games today. JetBrains Mono numbers. Brass color.
- **Rules teaser:** Brief excerpt of rules with link to full rules page. Decorative card illustration.
- **Footer:** Logo · Правила · Поверителност · Контакт · © Белот Online

---

#### 2. ПРАВИЛА ( /pravila )
**Purpose:** Teach new players Bulgarian Belot rules.

**Structure:**
- Page header: Playfair "Правила на Белот". Rule-brass divider below.
- Sidebar nav (sticky): sections — Карти, Наддаване, Разиграване, Анонси, Точкуване, Край на мача
- Content: Prose paragraphs. Cream text on felt panels. Tables for card values (JetBrains Mono for numbers).
- Card value table highlighted: trump vs non-trump, formatted with brass header row.
- Bid order: visual ascending chain (PASS → C → D → H → S → NT → AT).
- Announcement combos: illustrated with mini card components.
- No film grain on this page — readability over atmosphere.

---

#### 3. PREMIUM ( /premium )
**Purpose:** Upsell page for paid features.

**Structure:**
- Hero: "Играй без граници" — Playfair italic.
- Two pricing cards: Безплатно vs Премиум. Brass border on Premium card. Feature comparison list.
- Feature highlights: Tournament access, custom avatars, game history, no ads, priority matchmaking.
- FAQ accordion section.
- CTA: "Стани Премиум" — btn-brass.

---

#### 4. КЛАСАЦИЯ ( /klasacia )
**Purpose:** Public leaderboard for top players.

**Structure:**
- Top 3 podium: large, brass-accented, Playfair names.
- Table below: rank · avatar · username · wins · win% · points. JetBrains Mono for numbers.
- Filters: Седмична · Месечна · Всички времена (brass underline active state).
- Own rank card (if logged in) pinned to bottom of table — brass outline.
- No decorative elements on the table rows — clean, breathable rows.

---

#### 5. ВХОД ( /vhod )
**Purpose:** Authentication.

**Structure:**
- Centered card on felt background. Monogram above form.
- Plate-cream panel: email + password fields, "Вход" btn-brass.
- Divider "или" with OAuth buttons: Google · Facebook.
- Link to register. Link to forgot password.
- No ornaments on the form itself — form is Tier B logic (needs full attention).

---

#### 6. РЕГИСТРАЦИЯ ( /registracia )
**Purpose:** New account creation.

**Structure:**
- Same layout as login. Fields: username · email · password · confirm.
- Username availability check (async — ash "проверява се..." → brass ✓ / ember ✗).
- Accept terms checkbox. "Регистрирай се" btn-brass.

---

#### 7. ЗАБРАВЕНА ПАРОЛА ( /forgot-password )
Simple centered form. Email field. "Изпрати линк" btn-ghost.

---

#### 8. ТАБЛО / ЛОБИ ( /tablo )
**Purpose:** Main hub after login. Start or join a game.

**Structure:**
- Greeting: "Добре дошъл, [username]" — Playfair italic, cream.
- **Quick actions row:** [Нова стая] [Присъедини се] [Бързо намиране] — btn-brass · btn-ghost · btn-ghost.
- **Active rooms panel:** List of open rooms. Room code (Mono), player count (x/4), host name, game mode. Join btn-ghost per row. Brass border on joinable rooms.
- **Recent games:** Last 5 games. Score, result (Изкарана / Вкарана), date. Collapsed by default.
- **Stats sidebar:** Wins this week, win streak, total games — JetBrains Mono numbers.
- Corner ornaments present. Atmospheric — Tier A.

---

#### 9. СЪЗДАЙ СТАЯ ( /staya/nova )
**Purpose:** Configure a new game room.

**Structure:**
- Plate panel. Form fields:
  - Тип игра: Casual · Ranked · Tournament (radio, brass active)
  - Контра удвоява капот: toggle (default ON)
  - Максимален брой точки: 151 (editable)
  - Частна стая: toggle → generates room code
  - Поканени играчи: добави по username (typeahead)
- "Създай стая" btn-brass. "Отказ" btn-ghost.

---

#### 10. ЧАКАЛНЯ НА СТАЯ ( /staya/:id )
**Purpose:** 4 players gather before game starts.

**Structure:**
- Oval table visual (SVG). 4 seats. Filled seats show avatar + username. Empty seats show "Чака..." in ash.
- Room code: large, JetBrains Mono, brass color, click-to-copy.
- Share link button.
- Game settings summary (read-only for guests, editable for host).
- Chat panel (right side): simple text chat, no formatting.
- "Старт" btn-brass — only for host, only when 4/4 seats filled.
- Bot fill button ("Добави бот") per empty seat — host only.
- Atmosphere: full Tier A. Corner ornaments, felt texture.

---

#### 11. РЕЗУЛТАТ НА РЪКА ( overlay )
**Purpose:** Show hand scoring between tricks rounds.

**Structure:**
- Modal overlay (dark void background, 85% opacity).
- Plate-cream panel, centered.
- НС: [points] vs ИЗ: [points] — large JetBrains Mono.
- Breakdown: карти · анонси · капот · белот — table rows.
- Result badge: "ИЗКАРАНА" (brass) / "ВКАРАНА" (ember) / "ВИСЯЩА" (ash) — Playfair italic.
- Multiplier row if CONTRA/RECONTRA active.
- Running match score below (tens column).
- "Следваща ръка" btn-brass — auto-dismissed after 8 seconds.

---

#### 12. КРАЙ НА МАЧ — ПОБЕДА ( /game/:id/end )
**Purpose:** Cinematic victory / defeat screen.

**Structure:**
- Full viewport. Felt background.
- Winner team: large Playfair "ПОБЕДА" — brass, with SVG laurel / ornament.
- Loser team: smaller, ash color.
- Final score: large JetBrains Mono.
- Hand-by-hand history: collapsible accordion.
- Action row: "Нова игра" · "Лоби" · "Сподели резултат".
- Tier A — full cinematic. Brass glow on victor. Ember glow on loser side.

---

#### 13. ПРОФИЛ ( /profil/:username )
**Purpose:** Player stats and history.

**Structure:**
- Header: avatar (large) · username (Playfair) · rank badge (brass for ranked players).
- Stats row: Победи · Загуби · Win% · Streak · Любим договор.
- Recent games table: 20 rows. Score, result, contract played, date.
- Announcements history: карé от валета count, квинта count, etc.
- If own profile: edit avatar button, link to Settings.

---

#### 14. ТУРНИРИ ( /turniri )
**Purpose:** Browse and join tournaments.

**Structure:**
- Hero banner: "Турнири" — Playfair. Upcoming tournament highlight card.
- Tabs: Предстоящи · Активни · Приключили.
- Tournament cards: name, date, players (x/max), entry (free/premium), prize.
- Join btn-brass for eligible. Locked icon + "Премиум" for restricted.

---

#### 15. ТУРНИР ДЕТАЙЛ ( /turniri/:id )
**Purpose:** Tournament overview and bracket.

**Structure:**
- Header: Tournament name, format (Single elimination / Swiss), dates, prize.
- Bracket visual: SVG tree. Current round highlighted in brass.
- Participants list: avatars + usernames in a grid.
- My status (if registered): "Рунд 2 — очаква мач" etc.

---

#### 16. НАСТРОЙКИ ( /nastroyki )
**Purpose:** Account and preference settings.

**Structure:**
- Sidebar tabs: Профил · Игра · Известия · Акаунт · Поверителност.
- Профил: username, avatar upload, display name.
- Игра: card back preference, sound on/off, animation speed (Full / Reduced / Off), language (БГ / EN).
- Notifications: email prefs, in-app prefs.
- Акаунт: change email, change password, delete account (ember btn).
- No decoration on settings — pure utility. Tier A visuals (plate panels) but zero ornaments.

---

### TIER B — BATTLEFIELD SCREENS

---

#### 17. НАДДАВАНЕ ( /game/:id — bidding phase )
**Purpose:** 4 players bid for the contract.

**Design rules:**
- Background: flat #0e251c — no grain, no glow, no ornaments.
- HUD top: score row (NС vs ИЗ), room code, timer.
- Center: current highest bid, who bid it.
- Bid buttons: large, tap-friendly (min 44px), clear labels.
  - PASS (ash/ghost), C D H S NT AT (cream), КОНТРА (ember), РЕКОНТРА (ember-hi).
  - Only legal actions are enabled. Illegal = opacity 0.3, pointer-events none.
- Active player: seat illuminated with subtle felt-hi radial glow. No brass pulse — **static glow only** (no animation during opponent's turn).
- Hand preview (bottom): 5 cards, face-up, non-interactive during opponent's turn.
- Bid history: small right sidebar (desktop) / collapsed drawer (mobile). JetBrains Mono.

**Contra/Recontra moment:**
- When КОНТРА is played: ember color washes the bid area (CSS transition 200ms). No other animation. Sound cue if enabled. That's it. Clean and tense.

---

#### 18. РАЗИГРАВАНЕ ( /game/:id — play phase )
**Purpose:** The actual card game. Most critical screen.

**Design rules:**
- Background: #0e251c, flat. Zero ornaments. Zero grain.
- Table center: current trick cards. 4 positions (N/E/S/W layout). Winning card outlined in brass (static, no glow).
- Player hand (bottom): 8 cards → depletes to 0. Legal cards: full opacity, slight lift on hover (+4px). Illegal cards: 50% opacity, no hover. Selected card: brass border, lifted +8px.
- Opponents (top, left, right): avatar · username · card count · last played card (face-up, small).
- Score column (right, fixed): current trick points per team, JetBrains Mono.
- Announcements strip (appears on trick 1 only): "Каре от валета — НС +200". Auto-dismisses after 4 seconds.
- Active player indicator: **only** the seat label brightens to brass-hi. Nothing else moves.
- Timer: top-right, JetBrains Mono. Below 10s: turns ember. Below 5s: increases font size only (no animation).
- NO: film grain, brass glow, flourishes, ornaments, background texture, cinematic gradients.

---

## ANIMATION RULES

**Allowed animations (Tier B):**
- Card play: 180ms ease-out translate from hand position to table center.
- Trick sweep: 300ms, cards slide to trick winner's corner.
- Card hover: 120ms lift (+4px). No rotation.
- Active player transition: 80ms opacity change on seat label. Nothing else.
- Timer color: instant on threshold, no transition.

**Allowed animations (Tier A):**
- Brass pulse on active player in lobby: slow 3s sinusoidal, max 10% brightness delta.
- Victory screen entrance: 400ms fade-in, single upward translate on headline.
- Contra wash: 200ms ember color fill on bid zone.
- Page transitions: 150ms fade only. No slide, no zoom.

**Banned everywhere:**
- Continuous background animations.
- Decorative element entrance animations.
- Bounce or spring easings on game-critical elements.
- Any animation > 400ms during active play.

---

## COMPONENT STATES

All interactive components must implement all states:

| State | Treatment |
|---|---|
| default | Per design spec |
| hover | Brass-hi tint or lift (cards) |
| active/pressed | Slight scale 0.97, 80ms |
| focused | Brass 2px outline (keyboard nav) |
| disabled | 35% opacity, no pointer events |
| loading | Spinner in brass color, no layout shift |
| error | Ember border + ember text below field |
| success | Brass-hi border + ash confirmation text |

---

## MOBILE RULES ( < 768px )

- Nav collapses to hamburger. Full-screen overlay menu. Monogram at top.
- Game table: rotated landscape lock recommended. If portrait: compact layout — hand at bottom, opponents stacked above, trick center reduced.
- Card touch target: minimum 48×68px.
- All btn targets: minimum 44px height.
- Film grain: **disabled on mobile** (performance).
- Atmospheric glows: **disabled on mobile** (GPU).
- Ornaments: **disabled on mobile** (visual noise at small size).
- Score panel: collapsible bottom sheet in portrait mode.
- Bidding buttons: full-width grid (2×3) for the 6 bid options.

---

## BRASS USAGE CHECKLIST

Before adding brass to any element, it must satisfy at least one:
- [ ] Active/selected state
- [ ] Primary CTA (most important action on screen)
- [ ] Winner/victory indicator
- [ ] Ranked/premium badge
- [ ] Active player in current turn

If none apply → use cream, smoke, or ash instead.

---

## SCREENS SUMMARY TABLE

| # | Screen | Route | Tier | Notes |
|---|---|---|---|---|
| 1 | Landing | / | A | Cinematic hero, conversion focus |
| 2 | Правила | /pravila | A | Readable, minimal ornament |
| 3 | Premium | /premium | A | Sales page |
| 4 | Класация | /klasacia | A | Data-heavy, clean table |
| 5 | Вход | /vhod | A | Form focus, no ornament inside form |
| 6 | Регистрация | /registracia | A | Same as login |
| 7 | Забравена парола | /forgot | A | Utility only |
| 8 | Табло / Лоби | /tablo | A | Main hub |
| 9 | Създай стая | /staya/nova | A | Config form |
| 10 | Чакалня | /staya/:id | A | Pre-game gathering |
| 11 | Резултат на ръка | overlay | A | Between-hand scoring |
| 12 | Край на мач | /game/:id/end | A | Cinematic victory |
| 13 | Профил | /profil/:id | A | Stats and history |
| 14 | Турнири | /turniri | A | Browse tournaments |
| 15 | Турнир детайл | /turniri/:id | A | Bracket view |
| 16 | Настройки | /nastroyki | A | Utility, minimal decoration |
| 17 | Наддаване | /game/:id (bid) | **B** | Zero decoration |
| 18 | Разиграване | /game/:id (play) | **B** | Zero decoration |

---

*Версия 1.0 — Atmospheric Minimalism / Белот Online*
