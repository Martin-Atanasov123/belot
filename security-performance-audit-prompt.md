# Security & Performance Audit Prompt — Белот Online

Използвай този промпт с Claude, GPT-4o, Gemini, или директно с твоя AI асистент.
Дай му достъп до файловете по-долу и постави целия промпт.

---

## КОНТЕКСТ

Одитирай следния Node.js / Supabase проект за сигурност и производителност.
Проектът е real-time multiplayer card game (Bulgarian Belot).

**Stack:**
- Backend: Fastify + Socket.IO (authoritative game server)
- Frontend: React + Vite (client only renders, sends intents)
- Auth: Supabase JWT (optional — guests are allowed)
- State: In-memory `Map<string, Room>` — no database persistence yet
- Monorepo: npm workspaces (`packages/shared`, `packages/engine`, `packages/server`, `packages/client`)

**Файлове за одит (задължително прочети всички):**
```
packages/server/src/index.ts      ← Fastify + Socket.IO handlers
packages/server/src/room.ts       ← Room state machine
packages/server/src/supabase.ts   ← JWT verification, admin client
packages/server/.env.example      ← Environment variable template
packages/shared/src/types.ts      ← Shared types and schemas
```

---

## ЗАДАЧА

Направи **изчерпателен security и performance одит** на горните файлове.
Структурирай отговора точно в следните секции:

---

## СЕКЦИЯ 1 — CRITICAL SECURITY ISSUES

Намери и обясни всеки проблем от категория **Critical** (може да доведе до компрометиране на данни, auth bypass, или DoS).

За всеки проблем:
- Посочи точния файл и ред
- Обясни attack vector-а конкретно (не абстрактно)
- Дай fix — конкретен код, не само описание

**Провери задължително:**

1. **CORS wildcard** (`index.ts` line ~44-63):
   - Ако `CORS_ORIGIN` не е зададена в env → дефолтира до `'*'`.
   - `origin: CORS_ORIGIN.includes('*') ? true : CORS_ORIGIN` с `credentials: true` е невалидна комбинация в браузъри.
   - Какъв е реалният exploit? Кой може да злоупотреби?

2. **Unauthenticated `hostId` в POST /rooms** (`index.ts` line ~72-79):
   - `hostId` идва от request body без верификация.
   - Може ли атакуващ да се представи за друг user и да стане host?

3. **PlayerId identity trust** (`index.ts` room:join handler, `room.ts` line ~103-108):
   - `playerId` е string изпратен от клиента.
   - Сървърът го приема без да проверява дали съответства на authenticated JWT user.
   - Какво може да направи атакуващ с валиден JWT но измислен `playerId`?

4. **Supabase SERVICE_ROLE key scope** (`supabase.ts` line ~12-16):
   - Использува се service role key само за `auth.getUser(token)`.
   - Service role key байпасира всички RLS политики.
   - Каква е алтернативата? Оцени реалния риск ако ключът изтече.

5. **No rate limiting on socket events** (`index.ts`):
   - `game:action`, `room:join`, `room:spectate` — неограничени events per connection.
   - `room:react` има rate limit (1500ms) — само той.
   - Изчисли реалистичен DoS scenario при 100 connections, всяка спамираща `game:action`.

6. **No limit on room creation** (`POST /rooms`):
   - Един IP може да създаде неограничен брой стаи.
   - Rooms живеят 60 секунди след последния disconnect.
   - При какво количество стаи Node.js процесът ще се задуши?

7. **Bot playerId generation** (`room.ts` line ~139):
   - `Math.random()` е предсказуем при знаен seed.
   - Може ли атакуващ да предвиди bot playerId и да изпрати действия от негово име?

8. **Nickname sanitization** (`index.ts` room:join):
   - `nickname: z.string().min(1).max(20)` — само дължина, без sanitize.
   - Провери дали nickname се излъчва raw към всички клиенти без escaping.

9. **Health endpoint information disclosure** (`index.ts` line ~67):
   - `GET /health` връща `rooms: rooms.size`.
   - Оцени реалния риск vs utility.

10. **JWT expiry mid-game**:
    - Токенът се верифицира само при WebSocket handshake.
    - Ако JWT изтече по време на активна игра (default Supabase: 1 час), какво се случва?
    - Може ли expired JWT да продължи да играе?

---

## СЕКЦИЯ 2 — MEDIUM SECURITY ISSUES

За всеки medium проблем: файл + ред + конкретен fix.

**Провери задължително:**

1. **No CSRF protection на REST endpoints** (`POST /rooms`, `GET /rooms/:code`):
   - Fastify няма CSRF middleware по дефолт.
   - При какви условия е реален проблем за тази архитектура?

2. **Room code predictability** (`index.ts` line ~51):
   - `customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6)` = ~34^6 = ~1.5 милиарда комбинации.
   - При 1000 активни стаи, каква е вероятността за brute force намиране на валиден code?

3. **Spectator не изисква auth** (`room:spectate` handler):
   - Всеки може да spectate всяка стая без auth.
   - Добре ли е по дизайн или security gap?

4. **`room:setSettings` хост верификация** (`index.ts` line ~341):
   - `if (room.hostId !== playerId)` — правилно, но `hostId` е зададен от body на POST /rooms.
   - Circular trust issue: unauthed hostId guards unauthed settings change.

5. **Error messages leaking internals**:
   - Провери всички `return cb({ ok: false, error: '...' })` callbacks.
   - Кои error съобщения дават прекалено много информация на атакуващ?

6. **`Math.random()` за game seed** (`room.ts` line ~163):
   - `Math.floor(Math.random() * 2 ** 31)` — криптографски неслучаен.
   - В контекст на хазартна игра, оцени реалния риск и препоръчай алтернатива.

---

## СЕКЦИЯ 3 — PERFORMANCE ISSUES

За всеки проблем: обясни механизма, дай количествена оценка при scale, предложи fix.

**Провери задължително:**

1. **In-memory room storage** (`index.ts` line ~53, `room.ts`):
   - `const rooms = new Map<string, Room>()` — единична Node.js инстанция.
   - При рестарт на сървъра: всички активни игри са изгубени.
   - Хоризонтален scaling невъзможен (load balancer ще routing-не socket към грешна инстанция).
   - Предложи минимална persistence стратегия за MVP (Redis? Supabase?).

2. **`broadcastViews` — N проекции на всяко действие** (`index.ts` line ~137-154):
   - При всяко `game:action`, сървърът вика `projectView` 4 пъти + `projectSpectatorView` за всеки spectator.
   - При 100 активни игри с 5 spectators всяка: изчисли CPU cost на `game:action` burst.
   - Има ли смисъл от dirty-check преди emit?

3. **Supabase `auth.getUser()` при всеки WebSocket handshake** (`supabase.ts` line ~36):
   - Всеки нов socket connection прави HTTP call към Supabase API.
   - При 100 нови connections в секунда: latency impact?
   - Може ли JWT да се верифицира локално (без мрежова заявка) с Supabase JWT secret?

4. **4 setTimeout-а per Room** (`room.ts`, `index.ts`):
   - Всяка стая: `turnTimer`, `emptyTimer`, `botTimer`, `trickResolveTimer`.
   - При 500 активни стаи: 2000 потенциални active timers.
   - Провери за timer leaks — дали всички се cleanup-ват при room deletion.

5. **No WebSocket compression** (`index.ts` Socket.IO config):
   - `PlayerView` обекти са тежки (history, announcements, hands).
   - Socket.IO поддържа `perMessageDeflate` — включено ли е?
   - Estimирай размера на типичен `game:view` payload.

6. **No Fastify compression** (`index.ts`):
   - `@fastify/compress` не е регистриран.
   - Засяга само REST endpoints (не Socket.IO).

7. **`broadcastRoomState` + `broadcastViews` извикани заедно** (`afterTransition`):
   - При всяко действие: 1x `room:state` (всички в стаята) + 4x `game:view` (по един per seat).
   - Може ли `room:state` да се merge-не в `game:view` за намаляване на round-trips?

8. **Spectator view re-computed per-spectator** (`index.ts` line ~148-153):
   - `snapshotForSpectator(room)` се вика веднъж — добре.
   - Но `io.to(\`player:${sp.playerId}\`).emit(...)` loop-ва по всеки spectator.
   - При 50 spectators: 50 отделни Socket.IO emits вместо 1 room broadcast.
   - Защо не `io.to(\`spectators:${room.code}\`).emit(...)` с отделна spectator room?

9. **Engine `apply()` пълно копиране на state**:
   - Провери `packages/engine/src/match.ts` — дали state mutation-ите са immutable (spread) или in-place.
   - Deep spread на `GameSnapshot` с `hands: Record<Seat, Card[]>` и `handHistory` array при всяко действие.
   - При дълъг мач (10+ ръце), `handHistory` расте неограничено.

10. **No request body size limit** (`index.ts`):
    - Fastify default: 1MB per request.
    - `game:action` е малък payload — но има ли нужда от explicit limit?

---

## СЕКЦИЯ 4 — SUPABASE-SPECIFIC AUDIT

**Провери задължително:**

1. **RLS (Row Level Security)**:
   - Има ли RLS политики дефинирани за match_history, profiles, и всяка друга таблица?
   - Service role key байпасира RLS — всяка операция през `supabaseAdmin` е privileged.
   - Ако `supabase.ts` се използва и за запис на match history, всички write операции са unprotected.

2. **Migrations**:
   - Има ли `supabase/migrations/` директория с версионирани SQL файлове?
   - Ако не — базата е "ad-hoc" и schema drift е реален риск.

3. **Anon key vs Service role key**:
   - `.env.example` има и `SUPABASE_ANON_KEY` и `SUPABASE_SERVICE_ROLE_KEY`.
   - `supabase.ts` използва само `SERVICE_ROLE_KEY` — защо е включен `ANON_KEY`?
   - Предложи кой key трябва да се използва за кои операции.

4. **JWT local verification**:
   - Supabase JWTs са стандартни JWT подписани с `JWT_SECRET` от проекта.
   - `auth.getUser(token)` прави мрежова заявка. `jose` или `jsonwebtoken` могат да верифицират локално.
   - Напиши конкретна имплементация за локална JWT верификация с Supabase secret.

5. **Token refresh strategy**:
   - WebSocket connections могат да живеят часове.
   - Клиентът трябва да изпраща нов token при refresh — как?
   - Предложи socket event за `auth:refresh` или reconnect flow.

6. **Supabase project pausing**:
   - Free tier Supabase проекти се паузират след 7 дни неактивност.
   - При паузиран проект: `verifyAccessToken` ще хвърля грешка — как се обработва?
   - Провери `supabase.ts` line ~34-46 catch block.

---

## СЕКЦИЯ 5 — ARCHITECTURE GAPS

Идентифицирай структурни проблеми, които не са бъгове, но ще блокират scale или production readiness.

**Провери задължително:**

1. **Guest mode без identity**:
   - Guests нямат persistent identity — ако socket disconnect-не, re-join е по `playerId` string от клиента.
   - Ако клиентът е изгубил `playerId` (page refresh), играчът е изгубен от стаята завинаги.
   - Предложи минимален solution.

2. **No persistence = no replay, no audit trail**:
   - При crash: всички активни игри се губят.
   - Нито едно действие не се логва в база данни.
   - За MVP: достатъчно ли е? За launch: не.

3. **Single point of failure**:
   - 1 Node.js процес, 1 in-memory Map.
   - Ако процесът crash-не: всичко е загубено.
   - Препоръчай минимален approach (pm2 + Redis vs Supabase Realtime vs друго).

4. **Bot quality gap**:
   - `botAction` в PLAYING phase използва `autoPickOnTimeout` — lowest legal card.
   - Бота не знае кои карти са излезли, не оценява strength, не пази козовете.
   - Това не е security проблем, но е продуктов риск — играчите ще играят с/против некомпетентни ботове.

5. **No match history write** (`supabase.ts`):
   - Коментарът казва "bypass RLS when writing match history rows".
   - Но в `room.ts` и `index.ts` няма нито един `supabaseAdmin.from('...').insert(...)` call.
   - Match history е планирана но не имплементирана — документирай gap-а.

---

## ФОРМАТ НА ОТГОВОРА

За всеки намерен проблем използвай следния формат:

```
### [SEVERITY] Заглавие на проблема

**Файл:** `packages/server/src/index.ts:44`
**Описание:** Конкретно обяснение на проблема.
**Attack vector / Impact:** Как се злоупотребява и какви са последствията.
**Fix:**
\`\`\`typescript
// конкретен код
\`\`\`
```

Severity нива: CRITICAL / HIGH / MEDIUM / LOW / INFO

В края добави:

### ПРИОРИТИЗИРАН ACTION PLAN

Таблица с колони: Приоритет | Проблем | Effort | Impact | Fix в

Подредена от "направи веднага" до "преди launch" до "nice to have".

---

*Audit prompt версия 1.0 — Белот Online*
