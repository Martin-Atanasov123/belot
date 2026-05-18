import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PublicNav } from '../components/PublicNav.js'
import { Flourish, Monogram } from '../components/Ornaments.js'
import { useT } from '../i18n/index.js'
import { useAuth } from '../lib/auth.js'
import {
  createTournament,
  fetchTournaments,
  type TournamentRow,
  type TournamentStatus,
} from '../lib/tournaments.js'
import type { BracketSize } from '../lib/bracket.js'

// Tournaments list (DB-wired). Tabs filter Upcoming / Active / Finished.
// Authenticated users can open the "Create tournament" sheet to start a small
// bracket among friends — admins/managers can use the same flow for events.
type Tab = 'upcoming' | 'active' | 'finished'

const TAB_STATUS_MAP: Record<Tab, TournamentStatus[]> = {
  upcoming: ['upcoming', 'registration'],
  active:   ['active'],
  finished: ['finished'],
}

export function Tournaments() {
  const t = useT()
  const session = useAuth((s) => s.session)
  const user = useAuth((s) => s.user)
  const [tab, setTab] = useState<Tab>('upcoming')
  const [tournaments, setTournaments] = useState<TournamentRow[] | null>(null)
  const [creating, setCreating] = useState(false)

  // Fetch all tournaments once; tab filtering is purely client-side so switching
  // tabs is instant. The set is small (≤50 rows) so this is fine.
  useEffect(() => {
    let cancelled = false
    setTournaments(null)
    void fetchTournaments('all').then((rows) => {
      if (!cancelled) setTournaments(rows)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (!tournaments) return null
    const allowed = TAB_STATUS_MAP[tab]
    return tournaments.filter((t) => allowed.includes(t.status))
  }, [tournaments, tab])

  return (
    <div className="min-h-screen bg-ink relative">
      <PublicNav />
      <div className="pointer-events-none absolute inset-0 bg-felt-noise opacity-70" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-12 blur-3xl"
        style={{ background: 'radial-gradient(circle, #c9a25a 0%, transparent 60%)' }}
      />

      <main className="relative z-10 pt-20 sm:pt-24 pb-12 px-4 sm:px-6 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="flex justify-center mb-3">
            <Monogram size={42} />
          </div>
          <div className="eyebrow eyebrow-active mb-2">{t('tour.subtitle')}</div>
          <h1 className="font-display italic text-cream font-bold text-4xl sm:text-5xl lg:text-6xl leading-none">
            {t('tour.title')}
          </h1>
          <Flourish className="w-48 mx-auto mt-5 text-brass/40" />
        </motion.div>

        {/* Tabs */}
        <div className="flex items-center justify-between mb-8 gap-3 flex-wrap">
          <div className="flex items-center gap-1 overflow-x-auto">
            <TabBtn active={tab === 'upcoming'} onClick={() => setTab('upcoming')}>
              {t('tour.upcoming')}
            </TabBtn>
            <TabBtn active={tab === 'active'} onClick={() => setTab('active')}>
              {t('tour.active')}
            </TabBtn>
            <TabBtn active={tab === 'finished'} onClick={() => setTab('finished')}>
              {t('tour.finished')}
            </TabBtn>
          </div>
          {session && (
            <button onClick={() => setCreating(true)} className="btn-ghost text-xs">
              + {t('tour.create')}
            </button>
          )}
        </div>

        {/* List */}
        {filtered === null ? (
          <div className="plate p-10 text-center">
            <div className="font-display italic text-cream/60">{t('common.loading')}</div>
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="plate p-10 text-center"
          >
            <div className="font-display italic text-cream/70 text-lg mb-3">
              {t('tour.empty')}
            </div>
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-ash">
              {t('tour.regOpens')}
            </div>
          </motion.div>
        ) : (
          <motion.ul
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            {filtered.map((row) => (
              <TournamentCard key={row.id} row={row} />
            ))}
          </motion.ul>
        )}

        {/* Create sheet */}
        {creating && user && (
          <CreateSheet
            onClose={(created) => {
              setCreating(false)
              if (created) {
                // Refresh list
                void fetchTournaments('all').then(setTournaments)
              }
            }}
            creatorId={user.id}
          />
        )}
      </main>
    </div>
  )
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function TournamentCard({ row }: { row: TournamentRow }) {
  const t = useT()
  const starts = new Date(row.starts_at)
  const startsFmt = starts.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <li>
      <Link
        to={`/turniri/${row.id}`}
        className="block plate p-4 sm:p-5 hover:bg-brass/[0.04] transition group"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <StatusPill status={row.status} />
              <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-ash">
                {t('tour.formatSingleElim')} · {row.bracket_size}
              </span>
            </div>
            <h3 className="font-display italic text-cream group-hover:text-brass-hi transition text-xl sm:text-2xl truncate">
              {row.name}
            </h3>
            {row.winner_username && (
              <div className="font-mono text-[11px] text-brass-hi mt-1">
                ★ {row.winner_username}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="eyebrow text-[9px]">{t('tour.starts')}</div>
            <div className="font-mono text-cream text-sm mt-0.5">{startsFmt}</div>
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-ash mt-1">
              {row.registration_count} / {row.bracket_size}
            </div>
          </div>
        </div>
      </Link>
    </li>
  )
}

function StatusPill({ status }: { status: TournamentStatus }) {
  const t = useT()
  const cfg: Record<TournamentStatus, { label: string; cls: string }> = {
    upcoming:     { label: t('tour.statusUpcoming'),     cls: 'bg-ash/10 border-ash/30 text-ash' },
    registration: { label: t('tour.statusRegistration'), cls: 'bg-brass/15 border-brass/40 text-brass-hi' },
    active:       { label: t('tour.statusActive'),       cls: 'bg-emerald-500/10 border-emerald-400/40 text-emerald-300' },
    finished:     { label: t('tour.statusFinished'),     cls: 'bg-cream/[0.04] border-cream/20 text-cream/70' },
    cancelled:    { label: t('tour.statusCancelled'),    cls: 'bg-ember/10 border-ember/30 text-ember-hi' },
  }
  const c = cfg[status]
  return (
    <span
      className={`font-mono text-[9px] tracking-[0.22em] uppercase px-2 py-0.5 border rounded ${c.cls}`}
    >
      {c.label}
    </span>
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
      className={`relative px-4 py-2 font-mono text-xs tracking-[0.22em] uppercase transition shrink-0 ${
        active ? 'text-brass-hi' : 'text-ash hover:text-cream'
      }`}
    >
      {children}
      {active && (
        <motion.span
          layoutId="tour-tab-underline"
          className="absolute left-3 right-3 -bottom-px h-[2px] bg-brass"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
    </button>
  )
}

// Modal/sheet for creating a tournament. Stays inline (no portal) — covers
// the page with a backdrop. Defaults to a 4-player bracket starting in 24h.
function CreateSheet({
  onClose,
  creatorId,
}: {
  onClose: (created: boolean) => void
  creatorId: string
}) {
  const t = useT()
  const [name, setName] = useState('')
  const [size, setSize] = useState<BracketSize>(4)
  const [startsAt, setStartsAt] = useState(() => {
    const d = new Date(Date.now() + 24 * 3_600_000)
    return toLocalDatetime(d)
  })
  const [regCloseAt, setRegCloseAt] = useState(() => {
    const d = new Date(Date.now() + 23 * 3_600_000)
    return toLocalDatetime(d)
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const startISO = new Date(startsAt).toISOString()
    const regISO = new Date(regCloseAt).toISOString()
    if (new Date(regISO).getTime() > new Date(startISO).getTime()) {
      setError(t('tour.invalidDates'))
      return
    }
    setBusy(true)
    const r = await createTournament(
      { name: name.trim() || 'Tournament', bracketSize: size, startsAt: startISO, registrationClosesAt: regISO },
      creatorId,
    )
    setBusy(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    onClose(true)
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="plate p-6 sm:p-8 w-full max-w-md"
      >
        <div className="eyebrow eyebrow-active mb-2">{t('tour.createTitle')}</div>
        <Flourish className="w-20 text-brass/40 mb-4" />

        <label className="block mb-3">
          <span className="eyebrow text-[9px] block mb-1">{t('tour.createName')}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
            className="input-salon w-full"
            placeholder="Спатия Cup"
          />
        </label>

        <label className="block mb-3">
          <span className="eyebrow text-[9px] block mb-1">{t('tour.createSize')}</span>
          <select
            value={size}
            onChange={(e) => setSize(Number(e.target.value) as BracketSize)}
            className="input-salon w-full"
          >
            <option value={4}>4</option>
            <option value={8}>8</option>
            <option value={16}>16</option>
            <option value={32}>32</option>
          </select>
        </label>

        <label className="block mb-3">
          <span className="eyebrow text-[9px] block mb-1">{t('tour.createStarts')}</span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
            className="input-salon w-full"
          />
        </label>

        <label className="block mb-4">
          <span className="eyebrow text-[9px] block mb-1">{t('tour.createRegClose')}</span>
          <input
            type="datetime-local"
            value={regCloseAt}
            onChange={(e) => setRegCloseAt(e.target.value)}
            required
            className="input-salon w-full"
          />
        </label>

        {error && (
          <div className="mb-3 font-mono text-[11px] text-ember-hi">{error}</div>
        )}

        <div className="flex gap-2 mt-2">
          <button type="button" onClick={() => onClose(false)} className="btn-ghost flex-1">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={busy} className="btn-brass flex-1">
            {busy ? t('tour.creating') : t('tour.createSubmit')}
          </button>
        </div>
      </motion.form>
    </div>
  )
}

// "datetime-local" input expects `YYYY-MM-DDTHH:MM` in *local* time.
function toLocalDatetime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
