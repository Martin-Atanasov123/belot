import { motion } from 'framer-motion'
import { useGame } from '../store/game.js'
import { Flourish, Monogram, CornerOrnament } from './Ornaments.js'

export function Lobby() {
  const room = useGame((s) => s.room)!
  const amHost = useGame((s) => s.amHost)
  const start = useGame((s) => s.start)
  const url = window.location.href.split('?')[0] ?? window.location.href
  const allFilled = room.seats.every((s) => s.nickname !== null)
  const filled = room.seats.filter((s) => s.nickname !== null).length

  return (
    <div className="min-h-screen bg-ink relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-felt-noise opacity-90" />

      <CornerOrnament className="absolute top-5 left-5 w-10 h-10 text-brass/40" />
      <CornerOrnament className="absolute top-5 right-5 w-10 h-10 text-brass/40" style={{ transform: 'scaleX(-1)' } as React.CSSProperties} />

      <main className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="w-full max-w-2xl plate p-8 md:p-12"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Monogram size={36} />
              <div className="font-display italic text-cream/80 text-lg">Le Salon</div>
            </div>
            <div className="text-right">
              <div className="eyebrow text-ash">Стая №</div>
              <div className="font-mono text-2xl text-brass tracking-[0.32em]">{room.code}</div>
            </div>
          </div>

          <div className="rule-brass my-6" />

          {/* Invite line */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-7">
            <div className="flex-1 plate-cream px-4 py-3 truncate">
              <div className="eyebrow text-stone-600">Покана</div>
              <code className="font-mono text-stone-800 text-sm truncate block">{url}</code>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(url)}
              className="btn-brass shrink-0"
            >
              Копирай
            </button>
          </div>

          {/* Status line */}
          <div className="flex items-center justify-between mb-5">
            <div className="eyebrow text-brass">Около масата</div>
            <div className="font-display italic text-cream/70">
              <span className="text-cream">{filled}</span>
              <span className="text-ash"> от 4 заети</span>
            </div>
          </div>

          {/* Seat plates */}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {room.seats.map((s, i) => (
              <motion.li
                key={s.seat}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.06, duration: 0.5 }}
                className={`relative plate px-5 py-4 flex items-center gap-4 ${
                  s.nickname ? '' : 'opacity-70'
                }`}
              >
                <div className="font-display italic text-brass text-3xl leading-none w-10 text-center">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="eyebrow text-ash">Място</div>
                  <div className="font-display text-cream text-xl truncate">
                    {s.nickname ?? <span className="italic text-ash/70">свободно</span>}
                  </div>
                </div>
                {s.nickname && (
                  <span
                    className={`text-[10px] uppercase tracking-[0.25em] font-mono ${
                      s.connected ? 'text-brass' : 'text-ember-hi'
                    }`}
                  >
                    {s.connected ? '● ON LINE' : '○ OFF'}
                  </span>
                )}
              </motion.li>
            ))}
          </ul>

          <Flourish className="w-40 mx-auto text-brass/40 mb-6" />

          {amHost ? (
            <button
              onClick={() => void start()}
              disabled={!allFilled}
              className="btn-brass w-full"
            >
              {allFilled ? 'Започни играта' : `Изчакване — ${4 - filled} още`}
            </button>
          ) : (
            <div className="text-center font-display italic text-cream/70">
              Домакинът ще започне щом масата се запълни…
            </div>
          )}
        </motion.div>
      </main>
    </div>
  )
}
