# Белот онлайн

Real-time browser Belot (4 players) — Bulgarian rules. Monorepo with a pure TS rules engine, Fastify + Socket.IO server, and a React + Vite client.

```
packages/
  shared/   # types + zod schemas
  engine/   # pure game rules (86 tests, ≥95% coverage)
  server/   # Fastify + Socket.IO authoritative server (in-memory rooms)
  client/   # React + Vite + Tailwind frontend
```

## Run locally

Requires Node 20+. The repo uses npm workspaces.

```bash
npm install
```

In one terminal:
```bash
cd packages/server
npm run dev      # http://localhost:3001
```

In another:
```bash
cd packages/client
npm run dev      # http://localhost:5173
```

Open http://localhost:5173 in 4 browser tabs (or 4 browsers) to play. The host creates a room, copies the URL, and the other 3 paste it.

Engine tests:
```bash
cd packages/engine
npm test               # 86 unit tests
npm run test:coverage  # with v8 coverage
```

---

## Deploy to production

**Frontend** → Netlify · **Backend** → Render

### 1. Push this repo to GitHub

```bash
git init
git add .
git commit -m "initial belot"
git remote add origin https://github.com/<you>/belot.git
git push -u origin main
```

### 2. Backend on Render (free tier)

1. https://render.com → **New** → **Web Service** → connect your GitHub repo.
2. Render auto-detects `render.yaml`. Confirm: runtime = **Docker**, plan = **Free**.
3. On the first deploy, set the environment variable **`CORS_ORIGIN`** to your Netlify URL (you'll get this in step 3). For now you can leave it as `*` to test.
4. Wait for the build. The service URL looks like `https://belot-server.onrender.com`. Copy it.
5. Verify: open `https://<your-server>.onrender.com/health` → `{"ok":true,"rooms":0}`.

> **Free tier note:** the service sleeps after 15 minutes of inactivity and takes ~30 s to wake. Fine for friend games; upgrade to Starter ($7/mo) for always-on.

### 3. Frontend on Netlify

1. https://app.netlify.com → **Add new site** → **Import an existing project** → GitHub → pick the repo.
2. Netlify reads `netlify.toml` and pre-fills build settings. Confirm:
   - Base directory: `packages/client`
   - Build command: (auto from `netlify.toml`)
   - Publish directory: `dist`
3. **Site configuration → Environment variables** → add:
   - `VITE_SERVER_URL` = the Render URL from step 2 (e.g. `https://belot-server.onrender.com`)
4. Trigger a redeploy. After it's live, copy your Netlify URL.
5. Go back to Render → service → Environment → set `CORS_ORIGIN` to your Netlify URL (e.g. `https://belot.netlify.app`). Render will restart automatically.

### 4. Play

Open your Netlify URL, enter a nickname, click **Създай нова стая**, share the URL with 3 friends, hit **Започни играта** once all four seats fill.

---

## Anti-cheat

The server only emits per-seat `PlayerView` objects over the websocket. Other seats' cards are never sent — verified by the engine test in `packages/engine/test/match.spec.ts` ("PlayerView anti-cheat") and the local 4-client e2e in `room.ts`.

## What's not in this MVP (deferred per plan)

- Postgres / Redis persistence (rooms are in-memory; restart loses them)
- Auth (guest play only via a per-browser playerId in localStorage)
- Bots
- ELO / match history
- Replay UI
- Mobile-optimized hand layout (works, just not pretty)
- All-trumps capot variant special bonus

Plan and roadmap: `C:\Users\atana\.claude\plans\project-spec-belot-online-tender-duckling.md`.
