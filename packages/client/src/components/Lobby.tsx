import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Seat as SeatNum } from '@belot/shared'
import { useGame } from '../store/game.js'
import { useT } from '../i18n/index.js'
import { Flourish, Monogram, CornerOrnament } from './Ornaments.js'
import { LanguageToggle } from './LanguageToggle.js'

// Lobby (Чакалня) — per design spec §10.
// Tier A atmospheric: corner ornaments + felt noise.
// Centerpiece is an oval SVG table with 4 seat positions (N/E/S/W).
// Each seat shows: avatar circle (initial), nickname, online/offline/bot status.
// Empty seats: ash dashed circle + "Чака…" + (host only) "+ бот" button.

type Pos = 'N' | 'E' | 'S' | 'W'

// Seat order in the engine: 0 = South, 1 = West, 2 = North, 3 = East
// (partners N–S vs E–W). We map seat → visual position.
const SEAT_TO_POS: Record<number, Pos> = { 0: 'S', 1: 'W', 2: 'N', 3: 'E' }

function RulesPanel() {
  const t = useT()
  const room = useGame((s) => s.room)!
  const setSettings = useGame((s) => s.setSettings)
  const { capotDoubledByContra: capot, enableNT, enableAT, turnTimerSec, gameTo } = room.settings

  return (
    <div className="plate p-3 sm:p-4 border border-brass/25 flex flex-col gap-3">
      <div className="eyebrow eyebrow-active">{t('lobby.rulesTitle')}</div>

      {/* Game to — match length */}
      <SegmentedRow
        label={t('lobby.gameTo')}
        value={String(gameTo)}
        onChange={(v) => void setSettings({ gameTo: Number(v) as 101 | 151 })}
        options={[{ v: '151', label: '151' }, { v: '101', label: '101' }]}
        hint={t('lobby.gameToHint')}
      />

      {/* Turn timer */}
      <SegmentedRow
        label={t('lobby.turnTimer')}
        value={String(turnTimerSec)}
        onChange={(v) => void setSettings({ turnTimerSec: Number(v) })}
        options={[{ v: '15', label: '15s' }, { v: '30', label: '30s' }, { v: '60', label: '60s' }]}
      />

      {/* Allowed contracts — NT / AT toggles */}
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-cream text-sm">{t('lobby.contracts')}</span>
        <div className="flex gap-1">
          <ToggleChip on={enableNT} onClick={() => void setSettings({ enableNT: !enableNT })}>
            {t('suit.NT.short')}
          </ToggleChip>
          <ToggleChip on={enableAT} onClick={() => void setSettings({ enableAT: !enableAT })}>
            {t('suit.AT.short')}
          </ToggleChip>
        </div>
      </div>

      {/* Capot doubled by contra — the existing rule */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={capot}
          onChange={(e) => void setSettings({ capotDoubledByContra: e.target.checked })}
          className="mt-0.5 w-4 h-4 accent-brass cursor-pointer"
        />
        <div className="flex-1 min-w-0">
          <div className="font-display text-cream text-sm">{t('lobby.capotDouble')}</div>
          <div className="text-[10px] text-ash mt-0.5 italic">{t('lobby.capotDoubleHint')}</div>
        </div>
      </label>
    </div>
  )
}

function SegmentedRow({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ v: string; label: string }>
  hint?: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="font-display text-cream text-sm">{label}</span>
        <div className="flex gap-1">
          {options.map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => onChange(o.v)}
              className={`px-2.5 py-1 rounded font-mono text-[10px] tracking-[0.16em] uppercase border transition ${
                value === o.v
                  ? 'bg-brass/15 border-brass text-brass-hi'
                  : 'border-ash/25 text-ash hover:text-cream hover:border-cream/40'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {hint && <div className="text-[10px] text-ash italic">{hint}</div>}
    </div>
  )
}

function ToggleChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`px-2.5 py-1 rounded font-mono text-[10px] tracking-[0.16em] uppercase border transition ${
        on
          ? 'bg-brass/15 border-brass text-brass-hi'
          : 'border-ash/25 text-ash/60 hover:text-cream hover:border-cream/40'
      }`}
    >
      {children}
    </button>
  )
}

export function Lobby() {
  const t = useT()
  const room = useGame((s) => s.room)!
  const amHost = useGame((s) => s.amHost)
  const mySeat = useGame((s) => s.mySeat)
  const start = useGame((s) => s.start)
  const addBot = useGame((s) => s.addBot)
  const voteBots = useGame((s) => s.voteBots)
  // Quick-match rooms are public lobbies with a bot vote; private rooms have a
  // host who controls bots + start. Drives which controls show below.
  const isQuick = room.isQuickMatch
  const url = window.location.href.split('?')[0] ?? window.location.href
  const allFilled = room.seats.every((s) => s.nickname !== null)
  const filled = room.seats.filter((s) => s.nickname !== null).length
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      // ignore — secure context required for clipboard
    }
  }

  return (
    <div className="min-h-screen bg-ink relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-felt-noise opacity-90" />

      <CornerOrnament className="absolute top-5 left-5 w-10 h-10 sm:w-12 sm:h-12 text-brass/35" />
      <CornerOrnament
        className="absolute top-5 right-5 w-10 h-10 sm:w-12 sm:h-12 text-brass/35"
        style={{ transform: 'scaleX(-1)' } as React.CSSProperties}
      />
      <CornerOrnament
        className="absolute bottom-5 left-5 w-10 h-10 sm:w-12 sm:h-12 text-brass/35"
        style={{ transform: 'scaleY(-1)' } as React.CSSProperties}
      />
      <CornerOrnament
        className="absolute bottom-5 right-5 w-10 h-10 sm:w-12 sm:h-12 text-brass/35"
        style={{ transform: 'scale(-1,-1)' } as React.CSSProperties}
      />

      <LanguageToggle className="absolute top-5 left-1/2 -translate-x-1/2 z-30" />

      <main className="relative z-10 min-h-[100dvh] flex flex-col items-center justify-center px-3 sm:px-6 py-16 sm:py-12 gap-5 sm:gap-7">
        {/* Header: monogram + room code */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="flex justify-center mb-2">
            <Monogram size={40} />
          </div>
          <div className="eyebrow">{t('lobby.roomNo')}</div>
          <div className="font-mono text-2xl sm:text-3xl text-brass-hi tracking-[0.32em] mt-1">
            {room.code}
          </div>
          <div className="mt-2 inline-block font-mono text-[9px] tracking-[0.22em] uppercase px-2 py-0.5 rounded border border-brass/30 text-ash">
            {isQuick ? t('lobby.quickBadge') : t('lobby.privateBadge')}
          </div>
        </motion.div>

        {/* Seats display — dual layout:
            · SVG oval table on sm+ (preserves the visual spec §10)
            · Vertical card list on mobile (proper 44px tap targets,
              no off-screen "+ бот" buttons). */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-2xl"
        >
          {/* Tablet+ */}
          <div className="hidden sm:block">
            <OvalTable
              seats={room.seats}
              amHost={amHost && !isQuick}
              onAddBot={(seat: SeatNum) => void addBot(seat)}
              tWaiting={t('lobby.free')}
              tBot={t('common.bot')}
              tOnline={t('common.online')}
              tOffline={t('common.offline')}
              tAddBot={t('lobby.addBot')}
            />
          </div>
          {/* Mobile */}
          <div className="sm:hidden">
            <MobileSeatList
              seats={room.seats}
              amHost={amHost && !isQuick}
              onAddBot={(seat: SeatNum) => void addBot(seat)}
              tWaiting={t('lobby.free')}
              tBot={t('common.bot')}
              tOnline={t('common.online')}
              tOffline={t('common.offline')}
              tAddBot={t('lobby.addBot')}
              tSeat={t('lobby.seat')}
            />
          </div>
        </motion.div>

        {/* Invite + filled counter */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.5 }}
          className="w-full max-w-md flex flex-col gap-3"
        >
          <div className="flex items-center justify-between text-xs font-display italic text-cream/70">
            <span className="eyebrow">{t('lobby.atTable')}</span>
            <div className="flex items-center gap-3">
              <span>
                <span className="text-cream">{filled}</span>
                <span className="text-ash"> {t('lobby.ofTaken')}</span>
              </span>
              {room.spectatorCount > 0 && (
                <span className="text-brass-hi text-xs">
                  · {t('table.spectatorCount', { n: room.spectatorCount })}
                </span>
              )}
            </div>
          </div>

          {/* Invite link — private rooms only (quick match is public). */}
          {!isQuick && (
            <div className="flex items-stretch gap-2">
              <div className="flex-1 plate-cream px-3 py-2 min-w-0">
                <div className="eyebrow text-stone-700 text-[9px]">{t('lobby.invite')}</div>
                <code className="font-mono text-stone-900 text-[11px] sm:text-sm truncate block">
                  {url}
                </code>
              </div>
              <button onClick={onCopy} className="btn-brass shrink-0">
                {copied ? t('lobby.copied') : t('lobby.copy')}
              </button>
            </div>
          )}

          {amHost && !isQuick && <RulesPanel />}

          <Flourish className="w-40 mx-auto text-brass/40 mt-1" />

          {isQuick ? (
            // Quick match: 4 humans auto-start; otherwise vote to add bots (a
            // fallback timer fills them after a short wait so it never stalls).
            <>
              {mySeat !== null && !allFilled && (
                <button onClick={() => void voteBots()} className="btn-brass w-full">
                  {t('lobby.voteBots')} ({room.botVotes}/{room.botVoteThreshold})
                </button>
              )}
              <div className="text-center font-display italic text-cream/55 text-xs">
                {allFilled ? t('lobby.startingSoon') : t('lobby.quickWaitHint')}
              </div>
            </>
          ) : (
            // Private room: the host starts when ready.
            <>
              <button
                onClick={() => void start()}
                disabled={!allFilled}
                className="btn-brass w-full"
              >
                {allFilled ? t('lobby.start') : t('lobby.waiting', { n: 4 - filled })}
              </button>
              {!amHost && allFilled && (
                <div className="text-center font-display italic text-cream/55 text-xs">
                  {t('lobby.hostWillStart')}
                </div>
              )}
            </>
          )}
        </motion.div>
      </main>
    </div>
  )
}

// ── Oval table SVG ─────────────────────────────────────────────────────
// Pure SVG. Responsive via viewBox + Tailwind w-full. On narrow phones the
// oval shrinks proportionally so all 4 seats stay inside the visible area.
function OvalTable({
  seats,
  amHost,
  onAddBot,
  tWaiting,
  tBot,
  tOnline,
  tOffline,
  tAddBot,
}: {
  seats: Array<{ seat: SeatNum; nickname: string | null; connected: boolean; isBot: boolean }>
  amHost: boolean
  onAddBot: (seat: SeatNum) => void
  tWaiting: string
  tBot: string
  tOnline: string
  tOffline: string
  tAddBot: string
}) {
  // viewBox coordinate space — wider/taller than the felt so seat avatars,
  // captions, and "+ бот" buttons (positioned outside the rim) never clip.
  const W = 920
  const H = 600
  const cx = W / 2
  const cy = H / 2
  const rx = 280 // ellipse horizontal radius
  const ry = 150 // ellipse vertical radius

  // Seat-position offsets (relative to center). Slightly outside the felt rim so
  // avatars frame the table from the outside. With viewBox 920×600 and seats at
  // ±360 horizontally / ±210 vertically, every seat (r=42) plus its 100px-wide
  // "+ бот" button is comfortably inside the box.
  const seatXY: Record<Pos, { x: number; y: number }> = {
    N: { x: cx, y: cy - ry - 60 },
    S: { x: cx, y: cy + ry + 60 },
    W: { x: cx - rx - 80, y: cy },
    E: { x: cx + rx + 80, y: cy },
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label="Belot table seats"
    >
      <defs>
        <radialGradient id="felt-grad" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#1c5240" />
          <stop offset="60%" stopColor="#143b2e" />
          <stop offset="100%" stopColor="#0a1612" />
        </radialGradient>
        <filter id="felt-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#000" floodOpacity="0.55" />
        </filter>
      </defs>

      {/* Felt oval */}
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill="url(#felt-grad)"
        filter="url(#felt-shadow)"
      />
      {/* Brass rim */}
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill="none"
        stroke="#c9a25a"
        strokeOpacity="0.45"
        strokeWidth="2"
      />
      {/* Inner accent ring */}
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx - 14}
        ry={ry - 14}
        fill="none"
        stroke="#c9a25a"
        strokeOpacity="0.18"
        strokeWidth="1"
      />

      {/* Center monogram — decorative */}
      <g transform={`translate(${cx - 36}, ${cy - 36})`} opacity="0.18">
        <foreignObject x="0" y="0" width="72" height="72">
          <div style={{ width: '100%', height: '100%' }}>
            <Monogram size={72} />
          </div>
        </foreignObject>
      </g>

      {/* Seats */}
      {seats.map((seat) => {
        const pos = SEAT_TO_POS[seat.seat]!
        const xy = seatXY[pos]
        return (
          <Seat
            key={seat.seat}
            x={xy.x}
            y={xy.y}
            pos={pos}
            nickname={seat.nickname}
            connected={seat.connected}
            isBot={seat.isBot}
            seatIdx={seat.seat}
            amHost={amHost}
            onAddBot={onAddBot}
            tWaiting={tWaiting}
            tBot={tBot}
            tOnline={tOnline}
            tOffline={tOffline}
            tAddBot={tAddBot}
          />
        )
      })}
    </svg>
  )
}

function Seat({
  x,
  y,
  pos,
  nickname,
  connected,
  isBot,
  seatIdx,
  amHost,
  onAddBot,
  tWaiting,
  tBot,
  tOnline,
  tOffline,
  tAddBot,
}: {
  x: number
  y: number
  pos: Pos
  nickname: string | null
  connected: boolean
  isBot: boolean
  seatIdx: SeatNum
  amHost: boolean
  onAddBot: (seat: SeatNum) => void
  tWaiting: string
  tBot: string
  tOnline: string
  tOffline: string
  tAddBot: string
}) {
  const r = 42
  const occupied = nickname !== null
  // Initial for the avatar (first letter of nickname, or "?").
  const initial = (nickname?.trim()[0] ?? '?').toUpperCase()
  const statusLabel = isBot ? tBot : connected ? tOnline : tOffline
  const statusColor = isBot ? '#e6c178' : connected ? '#c9a25a' : '#a4303f'

  // Where to put the text caption (always reads downward except for N which reads upward).
  const textOffsetY = pos === 'N' ? -(r + 18) : r + 22
  const textAnchor: 'middle' = 'middle'

  return (
    <g transform={`translate(${x}, ${y})`}>
      {occupied ? (
        <>
          {/* Filled avatar */}
          <circle
            r={r}
            fill="#0e251c"
            stroke="#c9a25a"
            strokeOpacity={isBot ? 0.7 : connected ? 0.9 : 0.35}
            strokeWidth="2.5"
          />
          <text
            textAnchor={textAnchor}
            dy="0.36em"
            fontFamily='"Playfair Display", Georgia, serif'
            fontWeight="700"
            fontSize="34"
            fill={isBot ? '#e6c178' : '#f4eccb'}
          >
            {initial}
          </text>
        </>
      ) : (
        <>
          {/* Empty seat — dashed ash circle */}
          <circle
            r={r}
            fill="transparent"
            stroke="#9aa39c"
            strokeOpacity="0.5"
            strokeWidth="1.5"
            strokeDasharray="6 5"
          />
          <text
            textAnchor={textAnchor}
            dy="0.36em"
            fontFamily='"Playfair Display", Georgia, serif'
            fontStyle="italic"
            fontSize="18"
            fill="#9aa39c"
            opacity="0.7"
          >
            ?
          </text>
        </>
      )}

      {/* Nickname / waiting caption */}
      <text
        textAnchor={textAnchor}
        y={textOffsetY}
        fontFamily='"Playfair Display", Georgia, serif'
        fontStyle="italic"
        fontSize={occupied ? 22 : 18}
        fill={occupied ? '#f4eccb' : '#9aa39c'}
      >
        {occupied ? nickname : tWaiting}
      </text>

      {/* Status sub-caption (only for occupied seats) */}
      {occupied && (
        <text
          textAnchor={textAnchor}
          y={textOffsetY + (pos === 'N' ? -16 : 18)}
          fontFamily='"JetBrains Mono", ui-monospace, monospace'
          fontSize="10"
          letterSpacing="2"
          fill={statusColor}
          opacity={connected || isBot ? 1 : 0.85}
        >
          {statusLabel}
        </text>
      )}

      {/* Host "+ бот" button next to empty seats */}
      {!occupied && amHost && (
        <foreignObject
          x={-50}
          y={textOffsetY + (pos === 'N' ? -50 : 4)}
          width="100"
          height="34"
        >
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => onAddBot(seatIdx)}
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 border border-brass/40 hover:border-brass-hi text-brass hover:text-brass-hi rounded transition"
              title={tAddBot}
            >
              + {tAddBot}
            </button>
          </div>
        </foreignObject>
      )}
    </g>
  )
}

// ── Mobile seat list — vertical cards with proper 44px tap targets ─────
// Used below the `sm` breakpoint where the SVG oval becomes too small to
// interact with reliably (per spec §Mobile Rules: 44px min btn height).
// Same data + handlers as OvalTable; just a different presentation.
function MobileSeatList({
  seats,
  amHost,
  onAddBot,
  tWaiting,
  tBot,
  tOnline,
  tOffline,
  tAddBot,
  tSeat,
}: {
  seats: Array<{ seat: SeatNum; nickname: string | null; connected: boolean; isBot: boolean }>
  amHost: boolean
  onAddBot: (seat: SeatNum) => void
  tWaiting: string
  tBot: string
  tOnline: string
  tOffline: string
  tAddBot: string
  tSeat: string
}) {
  return (
    <ul className="flex flex-col gap-2">
      {seats.map((s, i) => {
        const occupied = s.nickname !== null
        const initial = (s.nickname?.trim()[0] ?? '?').toUpperCase()
        return (
          <li
            key={s.seat}
            className={`plate flex items-center gap-3 px-3 py-2.5 ${
              occupied ? '' : 'opacity-90'
            }`}
          >
            {/* Avatar circle — same styling as the SVG version (mini) */}
            <div
              aria-hidden
              className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-display font-bold text-xl ${
                occupied
                  ? `${
                      s.isBot
                        ? 'text-brass-hi border-brass/70'
                        : s.connected
                          ? 'text-cream border-brass/90'
                          : 'text-cream/70 border-ember/40'
                    } border-2 bg-racing/60`
                  : 'border border-dashed border-ash/40 text-ash/50 italic text-sm'
              }`}
            >
              {occupied ? initial : '?'}
            </div>

            {/* Seat info: name + status */}
            <div className="flex-1 min-w-0">
              <div className="eyebrow text-[8px]">
                {tSeat} {i + 1}
              </div>
              <div
                className={`font-display italic text-base truncate ${
                  occupied ? 'text-cream' : 'text-ash/70'
                }`}
              >
                {occupied ? s.nickname : tWaiting}
              </div>
              {occupied && (
                <div
                  className={`font-mono text-[9px] tracking-[0.18em] uppercase mt-0.5 ${
                    s.isBot
                      ? 'text-brass-hi'
                      : s.connected
                        ? 'text-brass'
                        : 'text-ember-hi'
                  }`}
                >
                  {s.isBot ? tBot : s.connected ? tOnline : tOffline}
                </div>
              )}
            </div>

            {/* "+ бот" — host only, for empty seats. 44px min height per spec. */}
            {!occupied && amHost && (
              <button
                onClick={() => onAddBot(s.seat)}
                className="shrink-0 font-mono text-[10px] tracking-[0.18em] uppercase px-3 min-h-[44px] border border-brass/40 hover:border-brass-hi text-brass hover:text-brass-hi rounded transition"
                title={tAddBot}
              >
                + {tAddBot}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

