import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PublicNav } from '../components/PublicNav.js'
import { Flourish, Monogram } from '../components/Ornaments.js'
import { useT } from '../i18n/index.js'
import type { MessageKey } from '../i18n/bg.js'
import { useAuth } from '../lib/auth.js'
import { createRoom } from '../lib/api.js'
import {
  fetchRegistrations,
  fetchTournament,
  fetchTournamentMatches,
  isRegistered,
  registerForTournament,
  reportMatchWinner,
  seedTournament,
  unregisterFromTournament,
  type TournamentMatchRow,
  type TournamentRegistration,
  type TournamentRow,
} from '../lib/tournaments.js'
import {
  matchesInRound,
  roundCount,
  roundLabel,
  type BracketSize,
} from '../lib/bracket.js'
import { supabase } from '../lib/supabase.js'

// Tournament detail page. Three states drive the UI:
//   - registration:     show register button + participants list
//   - active:           show live bracket + match cards
//   - finished:         show final bracket + champion
// The bracket SVG renders from real `tournament_matches` rows. Empty slots
// before seeding show "?", placeholder until round-1 is populated.

export function TournamentDetail() {
  const t = useT()
  const { id = '' } = useParams<{ id: string }>()
  const nav = useNavigate()
  const session = useAuth((s) => s.session)
  const user = useAuth((s) => s.user)

  const [tournament, setTournament] = useState<TournamentRow | null>(null)
  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([])
  const [matches, setMatches] = useState<TournamentMatchRow[]>([])
  const [registered, setRegistered] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!id) return
    const [tour, regs, ms] = await Promise.all([
      fetchTournament(id),
      fetchRegistrations(id),
      fetchTournamentMatches(id),
    ])
    setTournament(tour)
    setRegistrations(regs)
    setMatches(ms)
    if (user?.id) {
      setRegistered(await isRegistered(id, user.id))
    } else {
      setRegistered(false)
    }
    setLoading(false)
  }, [id, user?.id])

  useEffect(() => {
    setLoading(true)
    void reload()
  }, [reload])

  const onRegister = async () => {
    if (!user) return
    setBusy(true)
    setError(null)
    const r = await registerForTournament(id, user.id)
    setBusy(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    await reload()
  }

  const onUnregister = async () => {
    if (!user) return
    setBusy(true)
    setError(null)
    const r = await unregisterFromTournament(id, user.id)
    setBusy(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    await reload()
  }

  const onSeed = async () => {
    setBusy(true)
    setError(null)
    const r = await seedTournament(id)
    setBusy(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    await reload()
  }

  if (loading) {
    return <Shell><div className="plate p-10 text-center"><div className="font-display italic text-cream/60">{t('common.loading')}</div></div></Shell>
  }
  if (!tournament) {
    return (
      <Shell>
        <div className="plate p-10 text-center mt-6">
          <Monogram size={32} />
          <div className="eyebrow mt-3">{t('common.error')}</div>
          <p className="font-display italic text-cream/70 mt-2">404</p>
          <div className="mt-6">
            <Link to="/turniri" className="btn-ghost">← {t('tour.title')}</Link>
          </div>
        </div>
      </Shell>
    )
  }

  const isCreator = !!user && tournament.created_by === user.id  // safe even if null
  const canRegister =
    !!session &&
    (tournament.status === 'upcoming' || tournament.status === 'registration') &&
    new Date(tournament.registration_closes_at).getTime() > Date.now() &&
    tournament.registration_count < tournament.bracket_size
  const canUnregister = registered && tournament.status !== 'active' && tournament.status !== 'finished'
  const canSeed =
    isCreator &&
    (tournament.status === 'upcoming' || tournament.status === 'registration') &&
    registrations.length >= 2

  return (
    <Shell>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 text-center"
      >
        <div className="flex justify-center mb-3">
          <Monogram size={36} />
        </div>
        <div className="eyebrow eyebrow-active mb-2">{t('tour.subtitle')}</div>
        <h1 className="font-display italic text-cream text-3xl sm:text-4xl lg:text-5xl leading-none">
          {tournament.name}
        </h1>
        <Flourish className="w-40 mx-auto mt-4 text-brass/40" />
        {tournament.winner_username && (
          <div className="mt-4 font-mono text-brass-hi text-sm tracking-[0.22em] uppercase">
            ★ {t('tour.winner')} · {tournament.winner_username}
          </div>
        )}
      </motion.div>

      {/* Meta + actions */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="plate p-5 sm:p-6 mb-6"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetaCell label={t('tour.format')} value={t('tour.formatSingleElim')} />
          <MetaCell label={t('tour.starts')} value={fmtDate(tournament.starts_at)} />
          <MetaCell
            label={t('tour.players')}
            value={`${tournament.registration_count} / ${tournament.bracket_size}`}
          />
          <MetaCell
            label={t('tour.regClose')}
            value={fmtDate(tournament.registration_closes_at)}
          />
        </div>

        {/* Action row */}
        <div className="mt-5 pt-5 border-t border-brass/15 flex flex-wrap items-center gap-3">
          {!session ? (
            <Link to="/registracia" className="btn-brass">
              {t('tour.joinRequiresAuth')}
            </Link>
          ) : registered && canUnregister ? (
            <button onClick={onUnregister} disabled={busy} className="btn-ghost">
              {busy ? '…' : t('tour.leave')}
            </button>
          ) : canRegister ? (
            <button onClick={onRegister} disabled={busy} className="btn-brass">
              {busy ? t('tour.signingUp') : t('tour.join')}
            </button>
          ) : registered ? (
            <span className="font-mono text-[11px] tracking-[0.22em] uppercase text-brass-hi">
              ✓ {t('tour.signedUp')}
            </span>
          ) : tournament.registration_count >= tournament.bracket_size ? (
            <span className="font-mono text-[11px] tracking-[0.22em] uppercase text-ash">
              {t('tour.full')}
            </span>
          ) : (
            <span className="font-mono text-[11px] tracking-[0.22em] uppercase text-ash">
              {t('tour.regClosed')}
            </span>
          )}

          {canSeed && (
            <button onClick={onSeed} disabled={busy} className="btn-ghost text-xs">
              ▶ {busy ? t('tour.seeding') : t('tour.seed')}
            </button>
          )}

          {error && (
            <span className="font-mono text-[11px] text-ember-hi ml-2">{error}</span>
          )}
        </div>
      </motion.div>

      {/* Bracket (only when seeded) */}
      {matches.length > 0 ? (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.5 }}
          className="plate p-5 sm:p-8 mb-6 overflow-x-auto"
        >
          <div className="eyebrow eyebrow-active mb-4">{t('tour.bracket')}</div>
          <BracketView
            matches={matches}
            size={tournament.bracket_size as BracketSize}
            myUserId={user?.id ?? null}
            onMatchClick={async (m) => {
              // If both players present and this user is in the match, take them
              // to a room. We create a fresh room on demand (host = current user
              // if they're in the match), then update the tournament_match.room_code.
              if (!user) return
              const meInMatch = m.player_a_id === user.id || m.player_b_id === user.id
              if (!meInMatch || m.status === 'finished') return
              if (m.room_code) {
                nav(`/r/${m.room_code}`)
                return
              }
              const token = session?.access_token
              try {
                const { code } = await createRoom(user.id, token)
                // Persist room_code on the match row so opponents land in the same room.
                await supabase
                  .from('tournament_matches')
                  .update({ room_code: code, status: 'active', started_at: new Date().toISOString() })
                  .eq('id', m.id)
                nav(`/r/${code}?host=1`)
              } catch {
                setError('Failed to create match room')
              }
            }}
            onReportWin={async (m) => {
              if (!user) return
              const r = await reportMatchWinner(m.id, user.id)
              if (!r.ok) setError(r.error)
              else await reload()
            }}
            t={t}
          />
        </motion.section>
      ) : (
        <div className="plate p-8 text-center mb-6">
          <p className="font-display italic text-cream/55 text-sm">
            {t('tour.bracketPlaceholder')}
          </p>
        </div>
      )}

      {/* Participants */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24, duration: 0.5 }}
        className="plate p-5 sm:p-6"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="eyebrow eyebrow-active">{t('tour.participants')}</div>
          <span className="font-mono text-[10px] text-ash">
            {registrations.length} / {tournament.bracket_size}
          </span>
        </div>
        {registrations.length === 0 ? (
          <div className="font-display italic text-cream/55 text-center py-6 text-sm">
            {t('tour.empty')}
          </div>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {registrations.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-2 p-2 rounded border border-brass/15 bg-ink/40"
              >
                <Avatar username={r.username ?? '?'} avatar={r.avatar_url} />
                <Link
                  to={`/profil/${encodeURIComponent(r.username ?? '')}`}
                  className="font-display italic text-cream truncate hover:text-brass-hi transition text-sm"
                >
                  {r.username ?? '—'}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </motion.section>

      <div className="text-center mt-8">
        <Link to="/turniri" className="btn-ghost">← {t('tour.title')}</Link>
      </div>
    </Shell>
  )
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink relative">
      <PublicNav />
      <div className="pointer-events-none absolute inset-0 bg-felt-noise opacity-60" />
      <main className="relative z-10 pt-20 sm:pt-24 pb-12 px-4 sm:px-6 max-w-5xl mx-auto">
        {children}
      </main>
    </div>
  )
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="font-display italic text-cream/90 text-base sm:text-lg mt-1">
        {value}
      </div>
    </div>
  )
}

function Avatar({ username, avatar }: { username: string; avatar: string | null }) {
  const initial = (username.trim()[0] ?? '?').toUpperCase()
  if (avatar) {
    return <img src={avatar} alt="" className="w-7 h-7 rounded-full border border-brass/40 object-cover bg-racing/70" />
  }
  return (
    <div className="w-7 h-7 rounded-full border border-brass/40 flex items-center justify-center font-display font-bold text-cream text-xs bg-racing/70">
      {initial}
    </div>
  )
}

// ── Bracket SVG (data-driven) ───────────────────────────────────────────

function BracketView({
  matches,
  size,
  myUserId,
  onMatchClick,
  onReportWin,
  t,
}: {
  matches: TournamentMatchRow[]
  size: BracketSize
  myUserId: string | null
  onMatchClick: (m: TournamentMatchRow) => void
  onReportWin: (m: TournamentMatchRow) => void
  t: (k: MessageKey) => string
}) {
  // Layout constants. We render columns left→right (R1 first → Final).
  const COL_W = 200
  const SLOT_W = 170
  const SLOT_H = 56
  const V_GAP = 18

  const rounds = roundCount(size)
  const matchesByRound = useMemo(() => {
    const map = new Map<number, TournamentMatchRow[]>()
    for (let r = 1; r <= rounds; r++) {
      map.set(r, matches.filter((m) => m.round === r).sort((a, b) => a.slot - b.slot))
    }
    return map
  }, [matches, rounds])

  const round1Count = matchesInRound(size, 1)
  const totalHeight = round1Count * (SLOT_H + V_GAP) + 40
  const totalWidth = rounds * COL_W + 40

  // Compute y-center of each (round, slot) so we can draw connector lines.
  function slotY(round: number, slot: number): number {
    // For round 1, slots are evenly spaced.
    // For round r > 1, each slot is the midpoint of its two children in r-1.
    if (round === 1) {
      return 20 + slot * (SLOT_H + V_GAP) + SLOT_H / 2
    }
    const childA = slotY(round - 1, slot * 2)
    const childB = slotY(round - 1, slot * 2 + 1)
    return (childA + childB) / 2
  }

  return (
    <svg viewBox={`0 0 ${totalWidth} ${totalHeight}`} className="w-full h-auto min-w-[600px]">
      {/* Round labels */}
      {Array.from({ length: rounds }, (_, i) => i + 1).map((r) => (
        <text
          key={`label-${r}`}
          x={20 + (r - 1) * COL_W + SLOT_W / 2}
          y={12}
          textAnchor="middle"
          fontFamily='"JetBrains Mono", ui-monospace, monospace'
          fontSize="9"
          letterSpacing="2"
          fill="#c9a25a"
        >
          {roundLabel(size, r).toUpperCase()}
        </text>
      ))}

      {/* Connectors */}
      {Array.from({ length: rounds - 1 }, (_, i) => i + 1).map((r) => {
        const items = matchesByRound.get(r) ?? []
        return items.map((m) => {
          const x1 = 20 + (r - 1) * COL_W + SLOT_W
          const y1 = slotY(r, m.slot)
          const x2 = 20 + r * COL_W
          const y2 = slotY(r + 1, m.slot >> 1)
          const midX = (x1 + x2) / 2
          return (
            <g key={`conn-${r}-${m.slot}`} fill="none" stroke="#9aa39c" strokeOpacity="0.35" strokeWidth="1">
              <line x1={x1} y1={y1} x2={midX} y2={y1} />
              <line x1={midX} y1={y1} x2={midX} y2={y2} />
              <line x1={midX} y1={y2} x2={x2} y2={y2} />
            </g>
          )
        })
      })}

      {/* Match cards */}
      {Array.from({ length: rounds }, (_, i) => i + 1).map((r) => {
        const items = matchesByRound.get(r) ?? []
        const x = 20 + (r - 1) * COL_W
        return items.map((m) => {
          const cy = slotY(r, m.slot)
          const y = cy - SLOT_H / 2
          const meInMatch = !!myUserId && (m.player_a_id === myUserId || m.player_b_id === myUserId)
          return (
            <MatchSlot
              key={m.id}
              x={x}
              y={y}
              w={SLOT_W}
              h={SLOT_H}
              match={m}
              meInMatch={meInMatch}
              onClick={() => onMatchClick(m)}
              onReportWin={() => onReportWin(m)}
              t={t}
            />
          )
        })
      })}
    </svg>
  )
}

function MatchSlot({
  x, y, w, h, match, meInMatch, onClick, onReportWin, t,
}: {
  x: number
  y: number
  w: number
  h: number
  match: TournamentMatchRow
  meInMatch: boolean
  onClick: () => void
  onReportWin: () => void
  t: (k: MessageKey) => string
}) {
  const aWon = match.winner_id !== null && match.winner_id === match.player_a_id
  const bWon = match.winner_id !== null && match.winner_id === match.player_b_id
  const aName = match.player_a_name ?? (match.player_a_id ? '—' : t('tour.tba'))
  const bName = match.player_b_name ?? (match.player_b_id ? '—' : t('tour.tba'))

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={h}
        rx="4"
        fill="#0e251c"
        stroke={meInMatch ? '#e6c178' : '#9aa39c'}
        strokeOpacity={meInMatch ? 1 : 0.35}
        strokeWidth={meInMatch ? '1.8' : '1.2'}
      />
      {/* Top half — player A */}
      <SlotRow y={0} h={h / 2} name={aName} won={aWon} placeholder={!match.player_a_id} />
      <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="#9aa39c" strokeOpacity="0.18" />
      {/* Bottom half — player B */}
      <SlotRow y={h / 2} h={h / 2} name={bName} won={bWon} placeholder={!match.player_b_id} />

      {/* Foreign-object overlay for action buttons (HTML inside SVG) */}
      {meInMatch && match.status !== 'finished' && (match.status === 'ready' || match.status === 'active') && (
        <foreignObject x={w + 6} y={h / 2 - 12} width="120" height="48">
          <div className="flex flex-col gap-1">
            {match.status === 'ready' && (
              <button
                onClick={onClick}
                className="font-mono text-[9px] tracking-[0.18em] uppercase px-2 py-0.5 bg-brass/15 border border-brass/40 text-brass-hi rounded hover:bg-brass/25 transition"
              >
                ▶ {t('tour.playMatch')}
              </button>
            )}
            {match.status === 'active' && (
              <button
                onClick={onReportWin}
                className="font-mono text-[9px] tracking-[0.18em] uppercase px-2 py-0.5 bg-emerald-500/10 border border-emerald-400/40 text-emerald-300 rounded hover:bg-emerald-500/20 transition"
              >
                ✓ {t('tour.reportWin')}
              </button>
            )}
          </div>
        </foreignObject>
      )}
    </g>
  )
}

function SlotRow({
  y, h, name, won, placeholder,
}: {
  y: number
  h: number
  name: string
  won: boolean
  placeholder: boolean
}) {
  return (
    <g transform={`translate(0, ${y})`}>
      <text
        x="10"
        y={h / 2}
        dominantBaseline="central"
        fontFamily="ui-serif, Georgia, serif"
        fontStyle="italic"
        fontSize="13"
        fill={won ? '#e6c178' : placeholder ? '#6f7a73' : '#e6e6e3'}
      >
        {name.length > 18 ? name.slice(0, 17) + '…' : name}
      </text>
      {won && (
        <text
          x="160"
          y={h / 2}
          dominantBaseline="central"
          textAnchor="end"
          fontFamily='"JetBrains Mono", ui-monospace, monospace'
          fontSize="11"
          fill="#e6c178"
        >
          ★
        </text>
      )}
    </g>
  )
}

// ── helpers ─────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
