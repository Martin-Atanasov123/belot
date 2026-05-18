import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PublicNav } from '../components/PublicNav.js'
import { Flourish, Monogram } from '../components/Ornaments.js'
import { useT } from '../i18n/index.js'
import type { MessageKey } from '../i18n/bg.js'
import { useAuth } from '../lib/auth.js'
import {
  fetchProfileByUsername,
  fetchProfileMatches,
  computeStats,
  playerTeam,
  type MatchRow,
  type ProfileRow,
  type ProfileStats,
} from '../lib/stats.js'

// Profile page — per design spec §13 ПРОФИЛ.
// Now wired to public.profiles + public.matches (Phase C).
// Route: /profil/:username  — case-insensitive username lookup.

export function Profile() {
  const t = useT()
  const { username = '' } = useParams<{ username: string }>()
  const myProfile = useAuth((s) => s.profile)

  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setProfile(null)
    setMatches([])
    setStats(null)
    void (async () => {
      const p = await fetchProfileByUsername(username)
      if (cancelled) return
      if (!p) {
        setLoading(false)
        return
      }
      setProfile(p)
      const ms = await fetchProfileMatches(p.id, 20)
      if (cancelled) return
      setMatches(ms)
      setStats(computeStats(p.id, ms))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [username])

  const isMe = !!myProfile && !!profile && myProfile.id === profile.id
  const displayName = profile?.username ?? username
  const initial = (displayName.trim()[0] ?? '?').toUpperCase()

  return (
    <div className="min-h-screen bg-ink relative">
      <PublicNav />
      <div className="pointer-events-none absolute inset-0 bg-felt-noise opacity-60" />

      <main className="relative z-10 pt-20 sm:pt-24 pb-12 px-4 sm:px-6 max-w-5xl mx-auto">
        {loading ? (
          <div className="plate p-10 text-center mt-10">
            <div className="font-display italic text-cream/60">{t('common.loading')}</div>
          </div>
        ) : !profile ? (
          <NotFound nameTried={username} />
        ) : (
          <>
            {/* Header — avatar + username + member-since */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-8"
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-brass/60 object-cover bg-racing/70 shadow-lg"
                />
              ) : (
                <div
                  aria-hidden
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-brass/60 flex items-center justify-center font-display font-bold text-cream text-5xl bg-racing/70 shadow-lg"
                >
                  {initial}
                </div>
              )}
              <div className="text-center sm:text-left flex-1 min-w-0">
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <h1 className="font-display italic text-cream text-3xl sm:text-4xl truncate">
                    {profile.username}
                  </h1>
                  {isMe && (
                    <span className="font-mono text-[10px] tracking-[0.22em] uppercase px-2 py-0.5 bg-brass/15 border border-brass/40 text-brass-hi rounded">
                      {t('profile.youAre')}
                    </span>
                  )}
                  {profile.is_premium && (
                    <span className="font-mono text-[10px] tracking-[0.22em] uppercase px-2 py-0.5 bg-brass/25 border border-brass text-brass-hi rounded">
                      {t('prem.paid')}
                    </span>
                  )}
                </div>
                <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-ash mt-1">
                  {t('profile.member')} {formatMemberSince(profile.created_at)}
                </div>
              </div>
              <Flourish className="hidden sm:block w-32 text-brass/30" />
            </motion.div>

            {/* Stats row */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="plate p-5 sm:p-6 mb-6"
            >
              <div className="eyebrow eyebrow-active mb-4">{t('profile.stats')}</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label={t('profile.totalWins')} value={fmt(stats?.wins)} />
                <StatCard label={t('profile.totalLosses')} value={fmt(stats?.losses)} />
                <StatCard
                  label={t('profile.winRate')}
                  value={stats && stats.totalGames > 0 ? `${stats.winRate}%` : '—'}
                />
                <StatCard
                  label={t('profile.streak')}
                  value={stats && stats.streak !== 0 ? fmtStreak(stats.streak) : '—'}
                />
              </div>
            </motion.section>

            {/* History */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.5 }}
              className="plate p-5 sm:p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="eyebrow eyebrow-active">{t('profile.history')}</div>
                <span className="font-mono text-[10px] text-ash">
                  {matches.length}
                </span>
              </div>

              {matches.length === 0 ? (
                <>
                  <div className="text-center py-10 font-display italic text-cream/55 text-sm">
                    {t('profile.recentEmpty')}
                  </div>
                  {isMe && (
                    <div className="text-center">
                      <Link to="/tablo" className="btn-ghost">
                        {t('profile.playFirst')}
                      </Link>
                    </div>
                  )}
                </>
              ) : (
                <MatchHistory matches={matches} profileId={profile.id} t={t} />
              )}
            </motion.section>
          </>
        )}
      </main>
    </div>
  )
}

// ── Subcomponents ────────────────────────────────────────────────────────

function NotFound({ nameTried }: { nameTried: string }) {
  const t = useT()
  return (
    <div className="plate p-10 text-center mt-10">
      <Monogram size={36} />
      <div className="eyebrow mt-3">{t('profile.notFound')}</div>
      <h2 className="font-display italic text-cream text-2xl sm:text-3xl mt-2">
        {nameTried || '—'}
      </h2>
      <p className="font-display italic text-cream/65 max-w-md mx-auto mt-3 mb-6">
        {t('profile.notFoundHint')}
      </p>
      <div className="flex justify-center gap-3 flex-wrap">
        <Link to="/klasacia" className="btn-ghost">
          {t('nav.leaderboard')}
        </Link>
        <Link to="/" className="btn-brass">
          {t('error.goHome')}
        </Link>
      </div>
    </div>
  )
}

function MatchHistory({
  matches,
  profileId,
  t,
}: {
  matches: MatchRow[]
  profileId: string
  t: (k: MessageKey) => string
}) {
  return (
    <ul className="divide-y divide-brass/10">
      {matches.map((m) => {
        const team = playerTeam(m, profileId)
        const won = team === m.winner_team
        const my = team === 'NS' ? m.score_ns : m.score_ew
        const opp = team === 'NS' ? m.score_ew : m.score_ns
        const opponents =
          team === 'NS'
            ? [m.seat_e_name, m.seat_w_name].filter(Boolean) as string[]
            : [m.seat_n_name, m.seat_s_name].filter(Boolean) as string[]
        return (
          <li key={m.id} className="py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div
                className={`font-display italic text-base ${
                  won ? 'text-brass-hi' : 'text-cream/75'
                }`}
              >
                {won ? t('victory.title') : t('victory.defeatTitle')}
              </div>
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash mt-0.5 truncate">
                {t('profile.opponents')}: {opponents.join(' · ') || '—'}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-cream">
                <span className={won ? 'text-brass-hi' : 'text-cream'}>{my}</span>
                <span className="text-ash mx-1">:</span>
                <span className={won ? 'text-cream/70' : 'text-ember-hi'}>{opp}</span>
              </div>
              <div className="font-mono text-[10px] text-ash mt-0.5">
                {formatDate(m.finished_at)}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center px-2 py-3 rounded border border-brass/15 bg-ink/40">
      <div className="eyebrow text-[9px]">{label}</div>
      <div className="font-mono text-brass-hi text-2xl sm:text-3xl mt-1.5">{value}</div>
    </div>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────

function fmt(n: number | undefined): string {
  return typeof n === 'number' ? String(n) : '—'
}

function fmtStreak(streak: number): string {
  if (streak > 0) return `W${streak}`
  if (streak < 0) return `L${Math.abs(streak)}`
  return '—'
}

function formatMemberSince(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
