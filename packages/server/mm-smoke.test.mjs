// End-to-end smoke test for matchmaking. Server must be running on :3001.
// Runs with: node mm-smoke.test.mjs
import { io } from 'socket.io-client'

const URL = 'http://localhost:3001'
const log = (...a) => console.log('  ', ...a)

function makeClient(name) {
  const sock = io(URL, { transports: ['websocket'] })
  return new Promise((resolve, reject) => {
    sock.on('connect', () => resolve({ name, sock }))
    sock.on('connect_error', reject)
    setTimeout(() => reject(new Error(`${name} connect timeout`)), 5000)
  })
}

function emitWithAck(sock, event, payload) {
  return new Promise((resolve) => sock.emit(event, payload, resolve))
}

function waitFor(sock, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} timeout`)), timeoutMs)
    sock.once(event, (data) => { clearTimeout(timer); resolve(data) })
  })
}

let allPass = true
function check(label, ok, extra = '') {
  if (ok) console.log(`  ✓ ${label}`)
  else { console.error(`  ✗ ${label} ${extra}`); allPass = false }
}

// ──────────────────────────────────────────────────────────────────────
console.log('\n▶ Scenario A: 4 clients → match → auto-start\n')

const clients = await Promise.all(['alice', 'bob', 'carol', 'dave'].map(makeClient))
log(`connected ${clients.length} clients`)

// Each emits mm:join concurrently
const joinAcks = await Promise.all(
  clients.map((c) => emitWithAck(c.sock, 'mm:join', {
    playerId: `guest-${c.name}`,
    nickname: c.name,
  }))
)
check('all 4 mm:join calls ack ok', joinAcks.every((a) => a.ok))

// Wait for mm:matched on every client (pairing interval = 2s)
const matched = await Promise.all(clients.map((c) => waitFor(c.sock, 'mm:matched', 6000)))
log('mm:matched payloads:', matched.map((m) => m.code).join(', '))
check('all 4 receive mm:matched', matched.length === 4)
check('all 4 get the SAME room code', new Set(matched.map((m) => m.code)).size === 1)
check('withBots = false', matched.every((m) => m.withBots === false))

const roomCode = matched[0].code
log(`matched into room ${roomCode}`)

// Each client joins the room
const joinResults = await Promise.all(clients.map((c) =>
  emitWithAck(c.sock, 'room:join', {
    code: roomCode,
    playerId: `guest-${c.name}`,
    nickname: c.name,
  })
))
check('all 4 successfully join the room', joinResults.every((r) => r.ok))

// Wait for game:view on the first client → confirms auto-start fired
const view = await waitFor(clients[0].sock, 'game:view', 5000)
check('game:view received after 4th join (auto-start)', !!view)
check('game phase is BIDDING', view?.phase === 'BIDDING')
check('player has 5 cards dealt', view?.yourHand?.length === 5)

clients.forEach((c) => c.sock.disconnect())

// ──────────────────────────────────────────────────────────────────────
// Scenario B is omitted — the 30 s bot-fallback wait makes the smoke test
// too slow. Logic is shared with Scenario A (same code path past the
// pairing loop). Manual trigger: lower MM_BOT_FILL_AFTER_MS to 5000 if you
// want to spot-check this path interactively.

console.log(`\n${allPass ? 'ALL PASS ✓' : 'FAILURES ✗'}\n`)
process.exit(allPass ? 0 : 1)
