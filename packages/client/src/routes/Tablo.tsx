import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PublicNav } from '../components/PublicNav.js'
import { CornerOrnament, Flourish, Monogram } from '../components/Ornaments.js'
import { createRoom, fetchRooms, type RoomListing } from '../lib/api.js'
import { getNickname, getPlayerIdFor } from '../lib/identity.js'
import { useAuth } from '../lib/auth.js'
import { useT } from '../i18n/index.js'
import { useGame } from '../store/game.js'
import {
  computeStats,
  fetchProfileMatches,
  playerTeam,
  type MatchRow,
  type ProfileStats,
} from '../lib/stats.js'

// Lobby hub (Табло) — per design spec §8. Main authenticated hub.
// Currently runs in "guest mode" — uses the local nickname (no real auth yet).
// Atmospheric (Tier A): corner ornaments, plate panels, brass accents.
// Quick actions row at the top, active rooms list, recent games, stats sidebar.
//
// TODO when auth lands: gate behind `useAuth()`; pull real stats from DB.
export function Tablo() {
  const t = useT()
  const nav = useNavigate()
  const session = useAuth((s) => s.session)
  const profile = useAuth((s) => s.profile)
  const user = useAuth((s) => s.user)
  // Signed-in users keep their profile username; guests fall back to localStorage.
  const nick = (profile?.username ?? user?.email?.split('@')[0] ?? getNickname()) || 'Гост'
  const [busy, setBusy] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [recent, setRecent] = useState<MatchRow[]>([])
  const [activeRooms, setActiveRooms] = useState<RoomListing[]>([])
  const [roomsLoaded, setRoomsLoaded] = useState(false)

  // Matchmaking state — drives the Quick Play button into search / matched modes.
  const mmStatus = useGame((s) => s.mmStatus)
  const mmJoinedAt = useGame((s) => s.mmJoinedAt)
  const mmMatch = useGame((s) => s.mmMatch)
  const findMatch = useGame((s) => s.findMatch)
  const cancelFindMatch = useGame((s) => s.cancelFindMatch)
  const clearMMMatch = useGame((s) => s.clearMMMatch)
  const [mmElapsed, setMmElapsed] = useState(0)
  // How long Quick Play waits for real opponents before filling with bots.
  // 30s default · 2min · null = humans only (wait indefinitely).
  const [botFill, setBotFill] = useState<number | null>(30_000)

  // Tick a 1-Hz timer while searching so the button shows "13s · Cancel".
  useEffect(() => {
    if (mmStatus !== 'searching' || !mmJoinedAt) {
      setMmElapsed(0)
      return
    }
    const id = window.setInterval(() => {
      setMmElapsed(Math.floor((Date.now() - mmJoinedAt) / 1000))
    }, 1000)
    setMmElapsed(Math.floor((Date.now() - mmJoinedAt) / 1000))
    return () => window.clearInterval(id)
  }, [mmStatus, mmJoinedAt])

  // When the server pushes a match, navigate into the room and clear MM state.
  useEffect(() => {
    if (mmStatus !== 'matched' || !mmMatch) return
    const code = mmMatch.code
    clearMMMatch()
    nav(`/r/${code}`)
  }, [mmStatus, mmMatch, clearMMMatch, nav])

  // Poll active rooms every 5 s so the list stays live.
  useEffect(() => {
    let cancelled = false
    const load = () => {
      void fetchRooms().then((list) => {
        if (!cancelled) {
          setActiveRooms(list)
          setRoomsLoaded(true)
        }
      })
    }
    load()
    const id = window.setInterval(load, 5_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  // Pull the signed-in user's recent matches + aggregate stats for the sidebar.
  useEffect(() => {
    if (!user?.id) {
      setStats(null)
      setRecent([])
      return
    }
    let cancelled = false
    void fetchProfileMatches(user.id, 20).then((ms) => {
      if (cancelled) return
      setRecent(ms)
      setStats(computeStats(user.id, ms))
    })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const onCreate = async () => {
    setBusy(true)
    try {
      // Authed users get a stable playerId derived from their auth uid;
      // guests get the localStorage-cached uuid keyed by nickname.
      const playerId = user?.id ?? getPlayerIdFor(nick)
      // Pass the JWT so the server can verify the hostId rather than trusting the body.
      const token = session?.access_token
      const { code } = await createRoom(playerId, token)
      nav(`/r/${code}?host=1`)
    } finally {
      setBusy(false)
    }
  }
  const onJoin = () => {
    const c = joinCode.trim().toUpperCase()
    if (c) nav(`/r/${c}`)
  }

  const onQuickPlay = async () => {
    if (mmStatus === 'searching') {
      await cancelFindMatch()
      return
    }
    const playerId = user?.id ?? getPlayerIdFor(nick)
    const r = await findMatch({ playerId, nickname: nick, botFillAfterMs: botFill })
    if (!r.ok) {
      // Silent fallback — the button stays idle. Server already logs the reason.
      // eslint-disable-next-line no-console
      console.warn('[mm] findMatch failed:', r.error)
    }
  }

  return (
    <div className="min-h-screen bg-ink relative">
      <PublicNav />
      <div className="absolute inset-0 bg-felt-noise opacity-80 pointer-events-none" />

      <CornerOrnament className="absolute top-20 left-4 w-9 h-9 sm:w-12 sm:h-12 text-brass/25" />
      <CornerOrnament
        className="absolute top-20 right-4 w-9 h-9 sm:w-12 sm:h-12 text-brass/25"
        style={{ transform: 'scaleX(-1)' } as React.CSSProperties}
      />

      <main className="relative z-10 pt-20 sm:pt-24 pb-12 px-4 sm:px-6 max-w-6xl mx-auto">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3 mb-6 sm:mb-8"
        >
          <Monogram size={38} />
          <div>
            <div className="eyebrow">{t('tablo.greeting')}</div>
            <div className="font-display italic text-cream text-2xl sm:text-3xl">{nick}</div>
          </div>
        </motion.div>

        {/* Quick actions — primary CTA + secondary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8"
        >
          <button onClick={onCreate} disabled={busy} className="btn-brass">
            {busy ? t('landing.creating') : t('tablo.newRoom')}
          </button>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder={t('landing.codePh')}
              className="input-salon flex-1 font-mono text-center tracking-[0.32em] uppercase"
            />
            <button onClick={onJoin} className="btn-ghost shrink-0">
              {t('landing.join')}
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <button onClick={onQuickPlay} className="btn-ghost relative">
              {mmStatus === 'searching' ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner />
                  <span className="font-mono text-[10px] tracking-[0.18em]">
                    {t('mm.searching')} {mmElapsed}s · {t('mm.cancel')}
                  </span>
                </span>
              ) : (
                t('tablo.quickPlay')
              )}
            </button>
            {mmStatus !== 'searching' && (
              <div className="flex items-center gap-1" title={t('mm.waitHint')}>
                <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-ash mr-1">
                  {t('mm.botsIn')}
                </span>
                {([
                  { v: 30_000 as number | null, label: '30s' },
                  { v: 120_000 as number | null, label: '2m' },
                  { v: null as number | null, label: t('mm.never') },
                ]).map((opt) => {
                  const active = botFill === opt.v
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setBotFill(opt.v)}
                      className={`px-2 py-0.5 rounded font-mono text-[9px] tracking-[0.12em] uppercase border transition ${
                        active
                          ? 'bg-brass/15 border-brass text-brass-hi'
                          : 'border-ash/25 text-ash hover:text-cream hover:border-cream/40'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* Two-column area: active rooms + stats sidebar */}
        <div className="grid lg:grid-cols-[1fr_300px] gap-5 sm:gap-6">
          {/* LEFT: active rooms */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.5 }}
            className="plate p-5 sm:p-6"
          >
            <div className="eyebrow mb-4">{t('tablo.activeRooms')}</div>
            {!roomsLoaded ? (
              <div className="flex justify-center py-10">
                <span className="inline-block w-4 h-4 rounded-full border-2 border-brass/40 border-t-brass-hi animate-spin" />
              </div>
            ) : activeRooms.length === 0 ? (
              <div className="text-center py-10 font-display italic text-cream/55 text-sm">
                {t('tablo.activeEmpty')}
              </div>
            ) : (
              <ul className="divide-y divide-brass/10">
                {activeRooms.map((room) => {
                  const filledCount = room.seats.filter((s) => s.nickname !== null).length
                  const joinable = !room.inGame && filledCount < 4
                  const spectatable = room.inGame && room.settings.allowSpectators
                  const hostNick = room.seats.find((s) => s.nickname && !s.isBot)?.nickname ?? '—'
                  return (
                    <li
                      key={room.code}
                      className={`py-3 flex items-center gap-3 ${
                        joinable ? 'border-l-2 border-brass pl-3 -ml-3' : ''
                      }`}
                    >
                      <span className="font-mono text-sm text-brass tracking-[0.18em] shrink-0">
                        {room.code}
                      </span>
                      <span className="font-mono text-xs text-ash shrink-0">{filledCount}/4</span>
                      <span className="font-display italic text-cream/80 text-sm flex-1 truncate min-w-0">
                        {hostNick}
                      </span>
                      <span className={`font-mono text-[10px] tracking-[0.1em] shrink-0 ${room.inGame ? 'text-ash' : 'text-cream/55'}`}>
                        {room.inGame ? t('tablo.inGame') : `до ${room.settings.gameTo}`}
                      </span>
                      {(joinable || spectatable) && (
                        <button
                          onClick={() => nav(`/r/${room.code}`)}
                          className="btn-ghost py-1 px-3 text-xs shrink-0"
                        >
                          {spectatable ? t('tablo.spectate') : t('landing.join')}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            <Flourish className="w-32 mx-auto text-brass/30 mt-6" />

            <div className="mt-8">
              <div className="eyebrow mb-3">{t('tablo.recentGames')}</div>
              {recent.length === 0 ? (
                <div className="text-center py-6 font-display italic text-cream/55 text-sm">
                  {t('tablo.recentEmpty')}
                </div>
              ) : (
                <ul className="divide-y divide-brass/10">
                  {recent.slice(0, 5).map((m) => {
                    const team = user?.id ? playerTeam(m, user.id) : null
                    if (!team) return null
                    const won = team === m.winner_team
                    const my = team === 'NS' ? m.score_ns : m.score_ew
                    const opp = team === 'NS' ? m.score_ew : m.score_ns
                    const oppNames =
                      team === 'NS'
                        ? [m.seat_e_name, m.seat_w_name].filter(Boolean) as string[]
                        : [m.seat_n_name, m.seat_s_name].filter(Boolean) as string[]
                    return (
                      <li key={m.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div
                            className={`font-display italic text-sm ${
                              won ? 'text-brass-hi' : 'text-cream/75'
                            }`}
                          >
                            {won ? t('victory.title') : t('victory.defeatTitle')}
                          </div>
                          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash mt-0.5 truncate">
                            {oppNames.join(' · ') || '—'}
                          </div>
                        </div>
                        <div className="font-mono text-sm shrink-0">
                          <span className={won ? 'text-brass-hi' : 'text-cream'}>{my}</span>
                          <span className="text-ash mx-1">:</span>
                          <span className={won ? 'text-cream/70' : 'text-ember-hi'}>{opp}</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </motion.section>

          {/* RIGHT: stats sidebar */}
          <motion.aside
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.5 }}
            className="plate p-5 sm:p-6"
          >
            <div className="eyebrow mb-4">{t('tablo.statsTitle')}</div>
            <StatRow
              label={t('tablo.statsWinsWeek')}
              value={stats ? String(stats.winsLast7Days) : '—'}
            />
            <StatRow
              label={t('tablo.statsStreak')}
              value={stats && stats.streak !== 0 ? fmtStreak(stats.streak) : '—'}
            />
            <StatRow
              label={t('tablo.statsTotal')}
              value={stats ? String(stats.totalGames) : '—'}
            />
            <div className="mt-6 pt-4 border-t border-brass/15 text-center">
              {session ? (
                <Link to={`/profil/${encodeURIComponent(profile?.username ?? user?.email?.split('@')[0] ?? '')}`} className="font-mono text-[10px] tracking-[0.22em] uppercase text-brass-hi hover:underline">
                  {t('nav.profile')} →
                </Link>
              ) : (
                <Link to="/registracia" className="font-mono text-[10px] tracking-[0.22em] uppercase text-brass-hi hover:underline">
                  {t('nav.signup')} →
                </Link>
              )}
            </div>
          </motion.aside>
        </div>
      </main>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-2 border-b border-brass/10 last:border-0">
      <span className="font-display italic text-cream/70 text-sm">{label}</span>
      <span className="font-mono text-brass-hi text-lg">{value}</span>
    </div>
  )
}

// Tiny brass spinner for the Quick Play button while in queue.
function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block w-3 h-3 rounded-full border-2 border-brass/40 border-t-brass-hi animate-spin"
    />
  )
}

function fmtStreak(streak: number): string {
  if (streak > 0) return `W${streak}`
  if (streak < 0) return `L${Math.abs(streak)}`
  return '—'
}
