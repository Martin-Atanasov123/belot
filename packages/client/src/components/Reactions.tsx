import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGame } from '../store/game.js'
import type { Seat } from '@belot/shared'

// Allow-listed glyphs (must match the server's list).
const EMOTES = ['👏', '🤔', '😂', '🔥', '🙏', '😴'] as const

type Pos = 'bottom' | 'left' | 'top' | 'right'

// ── Bottom-right pop-up bar of emote buttons ────────────────────────
export function ReactionsBar({ canReact }: { canReact: boolean }) {
  const react = useGame((s) => s.react)
  const [open, setOpen] = useState(false)
  const [cooldown, setCooldown] = useState(false)

  if (!canReact) return null

  const send = async (e: string) => {
    if (cooldown) return
    setCooldown(true)
    setOpen(false)
    await react(e)
    setTimeout(() => setCooldown(false), 1600)
  }

  return (
    <div className="fixed bottom-3 right-3 z-40 flex flex-col items-end gap-2 pointer-events-none">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            className="plate p-1.5 flex gap-1 pointer-events-auto"
          >
            {EMOTES.map((e) => (
              <button
                key={e}
                onClick={() => void send(e)}
                disabled={cooldown}
                className="w-9 h-9 sm:w-10 sm:h-10 text-xl sm:text-2xl rounded hover:bg-brass/15 active:scale-90 transition disabled:opacity-40"
              >
                {e}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((v) => !v)}
        disabled={cooldown}
        aria-label="Reactions"
        className="pointer-events-auto w-11 h-11 sm:w-12 sm:h-12 rounded-full plate text-lg sm:text-xl flex items-center justify-center hover:brightness-110 active:scale-90 transition disabled:opacity-50"
      >
        {open ? '×' : '👏'}
      </button>
    </div>
  )
}

// ── Floating emote that briefly hovers above the seat that sent it ──
export function FloatingReactions({
  visualPosForSeat,
}: {
  visualPosForSeat: (seat: Seat) => Pos
}) {
  const reactions = useGame((s) => s.reactions)
  const dismiss = useGame((s) => s.dismissReaction)

  // Each reaction auto-dismisses after 1800ms.
  useEffect(() => {
    const timers = reactions.map((r) =>
      setTimeout(() => dismiss(r.id), 1800),
    )
    return () => { for (const t of timers) clearTimeout(t) }
  }, [reactions, dismiss])

  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      <AnimatePresence>
        {reactions.map((r) => {
          const pos = visualPosForSeat(r.seat)
          const anchor = anchorForPos(pos)
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, scale: 0.5, y: 0 }}
              animate={{ opacity: 1, scale: 1.2, y: -24 }}
              exit={{ opacity: 0, scale: 0.6, y: -52, transition: { duration: 0.5 } }}
              transition={{ type: 'spring', stiffness: 220, damping: 18 }}
              style={anchor}
              className="absolute text-4xl sm:text-5xl select-none drop-shadow-[0_3px_8px_rgba(0,0,0,0.6)]"
            >
              {r.emote}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

// Anchor a floating emote toward the visual seat slot. The exact pixel
// position matches roughly where the seat badge sits in the Table layout.
// Each branch returns a fully-keyed plain object (no `undefined` fields)
// so framer-motion's strict MotionStyle accepts it directly.
type Anchor = { left?: string | number; right?: string | number; top?: string | number; bottom?: string | number; transform: string }
function anchorForPos(pos: Pos): Anchor {
  switch (pos) {
    case 'bottom': return { left: '50%', bottom: 130, transform: 'translateX(-50%)' }
    case 'top':    return { left: '50%', top:    80, transform: 'translateX(-50%)' }
    case 'left':   return { left: 70,    top: '50%', transform: 'translateY(-50%)' }
    case 'right':  return { right: 70,   top: '50%', transform: 'translateY(-50%)' }
  }
}
