import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PublicNav } from '../components/PublicNav.js'
import { CornerOrnament, Flourish, Monogram } from '../components/Ornaments.js'
import { createRoom } from '../lib/api.js'
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
  const findMatch = useGame((s) => s.findMatch)
  const connect = useGame((s) => s.connect)
  const onlineCount = useGame((s) => s.onlineCount)

  // Wake the socket on Tablo mount so the "X играчи онлайн" chip is live and
  // quick-match doesn't pay an additional handshake. The store keeps a single
  // shared socket, so this is idempotent across navigations.
  useEffect(() => {
    connect()
  }, [connect])

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
    const playerId = user?.id ?? getPlayerIdFor(nick)
    const r = await findMatch({ playerId, nickname: nick })
    if (r.ok && r.code) {
      // Land in the public lobby; players gather there and vote on bots.
      nav(`/r/${r.code}`)
    } else {
      // eslint-disable-next-line no-console
      console.warn('[quickmatch] failed:', r.error)
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
          <div className="flex-1">
            <div className="eyebrow">{t('tablo.greeting')}</div>
            <div className="font-display italic text-cream text-2xl sm:text-3xl">{nick}</div>
          </div>
          {onlineCount > 0 && (
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-brass/25 bg-felt/40"
              title={t('tablo.onlineHint')}
            >
              <span className="w-2 h-2 rounded-full bg-brass-hi" />
              <span className="font-mono text-[11px] tracking-[0.22em] uppercase text-cream/85">
                {onlineCount} {t('tablo.online')}
              </span>
            </div>
          )}
        </motion.div>

        {/* Two ways to play, kept in separate labelled cards so the "with
            friends" flow (create / join by code) isn't lost among the solo
            matchmaking options. */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-8"
        >
          {/* ── With friends: create a room or join by code ── */}
          <div className="plate p-5 sm:p-6 flex flex-col gap-3">
            <div>
              <div className="eyebrow eyebrow-active">{t('tablo.withFriends')}</div>
              <p className="font-display italic text-cream/55 text-xs mt-1">
                {t('tablo.withFriendsHint')}
              </p>
            </div>
            <button onClick={onCreate} disabled={busy} className="btn-brass w-full">
              {busy ? t('landing.creating') : t('tablo.newRoom')}
            </button>
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-brass/15" />
              <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-ash">
                {t('tablo.orJoinCode')}
              </span>
              <div className="h-px flex-1 bg-brass/15" />
            </div>
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
          </div>

          {/* ── Quick match: jump into a public lobby with whoever's online ── */}
          <div className="plate p-5 sm:p-6 flex flex-col gap-3 justify-between">
            <div>
              <div className="eyebrow">{t('tablo.soloTitle')}</div>
              <p className="font-display italic text-cream/55 text-xs mt-1">
                {t('tablo.soloHint')}
              </p>
            </div>
            <button onClick={onQuickPlay} className="btn-ghost w-full">
              {t('tablo.quickPlay')}
            </button>
          </div>
        </motion.div>

        {/* Two-column area: active rooms + stats sidebar */}
        <div className="grid lg:grid-cols-[1fr_300px] gap-5 sm:gap-6">
          {/* LEFT: recent games */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.5 }}
            className="plate p-5 sm:p-6"
          >
            <div className="eyebrow mb-4">{t('tablo.recentGames')}</div>
            {recent.length === 0 ? (
              <div className="text-center py-10 font-display italic text-cream/55 text-sm">
                {t('tablo.recentEmpty')}
              </div>
            ) : (
              <ul className="divide-y divide-brass/10">
                {recent.slice(0, 6).map((m) => {
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
            <Flourish className="w-32 mx-auto text-brass/30 mt-6" />
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

function fmtStreak(streak: number): string {
  if (streak > 0) return `W${streak}`
  if (streak < 0) return `L${Math.abs(streak)}`
  return '—'
}
