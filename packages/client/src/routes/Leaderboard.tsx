import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PublicNav } from '../components/PublicNav.js'
import { Flourish, Monogram } from '../components/Ornaments.js'
import { useT } from '../i18n/index.js'
import { useAuth } from '../lib/auth.js'
import { fetchLeaderboard, type LeaderboardRow, type LeaderboardScope } from '../lib/stats.js'

// Leaderboard page — per spec §4 КЛАСАЦИЯ.
// Tier A (atmospheric). Brass underline on active tab, no background highlight.
// Numbers in JetBrains Mono. Wired to Supabase via `lib/stats.ts`.
export function Leaderboard() {
  const t = useT()
  const profile = useAuth((s) => s.profile)
  const [scope, setScope] = useState<LeaderboardScope>('weekly')
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setRows(null)
    void fetchLeaderboard(scope).then((data) => {
      if (cancelled) return
      setRows(data)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [scope])

  const myRow = useMemo(() => {
    if (!profile || !rows) return null
    const idx = rows.findIndex((r) => r.player_id === profile.id)
    if (idx === -1) return null
    return { row: rows[idx]!, rank: idx + 1 }
  }, [rows, profile])

  return (
    <div className="min-h-screen bg-ink relative">
      <PublicNav />
      <div className="absolute inset-0 bg-felt-noise opacity-80 pointer-events-none" />

      <main className="relative z-10 pt-24 sm:pt-28 pb-12 px-4 sm:px-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="flex justify-center mb-3">
            <Monogram size={42} />
          </div>
          <div className="eyebrow eyebrow-active mb-2">{t('lb.subtitle')}</div>
          <h1 className="font-display text-cream font-bold text-4xl sm:text-5xl lg:text-6xl leading-none">
            {t('lb.title')}
          </h1>
          <Flourish className="w-48 mx-auto mt-5 text-brass/40" />
        </motion.div>

        {/* Tabs — brass underline only on active, per spec */}
        <div className="flex items-center justify-center gap-1 mb-8">
          <TabBtn active={scope === 'weekly'} onClick={() => setScope('weekly')}>
            {t('lb.tabWeekly')}
          </TabBtn>
          <TabBtn active={scope === 'monthly'} onClick={() => setScope('monthly')}>
            {t('lb.tabMonthly')}
          </TabBtn>
          <TabBtn active={scope === 'all'} onClick={() => setScope('all')}>
            {t('lb.tabAllTime')}
          </TabBtn>
        </div>

        {loading || rows === null ? (
          <div className="plate p-10 text-center">
            <div className="font-display italic text-cream/60">{t('common.loading')}</div>
          </div>
        ) : rows.length === 0 ? (
          <div className="plate p-10 text-center">
            <div className="font-display italic text-cream/70 text-lg mb-2">{t('lb.empty')}</div>
          </div>
        ) : (
          <>
            <motion.div
              key={scope}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="plate overflow-hidden"
            >
              <table className="w-full">
                <thead>
                  <tr className="bg-brass/10">
                    <th className="text-left px-4 py-3 font-mono text-[10px] tracking-[0.22em] uppercase text-brass-hi w-12">
                      {t('lb.rank')}
                    </th>
                    <th className="text-left px-4 py-3 font-mono text-[10px] tracking-[0.22em] uppercase text-brass-hi">
                      {t('lb.player')}
                    </th>
                    <th className="text-right px-4 py-3 font-mono text-[10px] tracking-[0.22em] uppercase text-brass-hi">
                      {t('lb.games')}
                    </th>
                    <th className="text-right px-4 py-3 font-mono text-[10px] tracking-[0.22em] uppercase text-brass-hi">
                      {t('lb.wins')}
                    </th>
                    <th className="text-right px-4 py-3 font-mono text-[10px] tracking-[0.22em] uppercase text-brass-hi">
                      {t('lb.winPct')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const isMe = profile?.id === r.player_id
                    return (
                      <tr
                        key={r.player_id}
                        className={`border-t border-brass/10 transition ${
                          isMe ? 'bg-brass/[0.08]' : 'hover:bg-cream/[0.03]'
                        }`}
                      >
                        <td className="px-4 py-3 font-mono text-brass-hi text-sm">
                          {i + 1}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/profil/${encodeURIComponent(r.username)}`}
                            className="font-display italic text-cream hover:text-brass-hi transition"
                          >
                            {r.username}
                          </Link>
                          {isMe && (
                            <span className="ml-2 font-mono text-[9px] tracking-[0.22em] uppercase px-1.5 py-0.5 bg-brass/15 border border-brass/40 text-brass-hi rounded">
                              {t('common.you')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-cream/75">
                          {r.games_played}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-cream">
                          {r.games_won}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-brass-hi">
                          {r.win_pct}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </motion.div>

            {myRow && (
              <div className="mt-4 text-center font-mono text-[11px] tracking-[0.22em] uppercase text-ash">
                {t('lb.yourRank')}: <span className="text-brass-hi">#{myRow.rank}</span>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2 font-mono text-xs tracking-[0.22em] uppercase transition ${
        active ? 'text-brass-hi' : 'text-ash hover:text-cream'
      }`}
    >
      {children}
      {active && (
        <motion.span
          layoutId="lb-tab-underline"
          className="absolute left-3 right-3 -bottom-px h-[2px] bg-brass"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
    </button>
  )
}
