import { useState } from 'react'
import { motion } from 'framer-motion'

const isMobileLikely = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
import { useGame } from '../store/game.js'
import { useT } from '../i18n/index.js'
import { Flourish, Monogram, CornerOrnament } from './Ornaments.js'
import { LanguageToggle } from './LanguageToggle.js'

function RulesPanel() {
  const t = useT()
  const room = useGame((s) => s.room)!
  const setSettings = useGame((s) => s.setSettings)
  const capot = room.settings.capotDoubledByContra

  return (
    <div className="mb-5 plate p-3 sm:p-4 border border-brass/30">
      <div className="eyebrow text-brass mb-2">{t('lobby.rulesTitle')}</div>
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

export function Lobby() {
  const t = useT()
  const room = useGame((s) => s.room)!
  const amHost = useGame((s) => s.amHost)
  const start = useGame((s) => s.start)
  const addBot = useGame((s) => s.addBot)
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
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-ink relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-felt-noise opacity-90" />

      <CornerOrnament className="absolute top-5 left-5 w-10 h-10 text-brass/40" />
      <CornerOrnament className="absolute top-5 right-5 w-10 h-10 text-brass/40" style={{ transform: 'scaleX(-1)' } as React.CSSProperties} />
      <LanguageToggle className="absolute top-5 left-1/2 -translate-x-1/2 z-30" />

      <main className="relative z-10 min-h-[100dvh] flex items-center justify-center p-3 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="w-full max-w-2xl plate p-5 sm:p-8 md:p-12"
        >
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Monogram size={isMobileLikely() ? 28 : 36} />
              <div className="font-display italic text-cream/80 text-base sm:text-lg truncate">{t('common.salon')}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="eyebrow text-ash text-[9px] sm:text-[10px]">{t('lobby.roomNo')}</div>
              <div className="font-mono text-xl sm:text-2xl text-brass tracking-[0.28em] sm:tracking-[0.32em]">{room.code}</div>
            </div>
          </div>

          <div className="rule-brass my-6" />

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mb-5 sm:mb-7">
            <div className="flex-1 plate-cream px-3 sm:px-4 py-2 sm:py-3 min-w-0">
              <div className="eyebrow text-stone-600 text-[9px] sm:text-[10px]">{t('lobby.invite')}</div>
              <code className="font-mono text-stone-800 text-[11px] sm:text-sm truncate block">{url}</code>
            </div>
            <button onClick={onCopy} className="btn-brass shrink-0 py-2 sm:py-3">
              {copied ? t('lobby.copied') : t('lobby.copy')}
            </button>
          </div>

          {/* Table rules — host can adjust before the game starts */}
          {amHost && <RulesPanel />}

          <div className="flex items-center justify-between mb-5">
            <div className="eyebrow text-brass">{t('lobby.atTable')}</div>
            <div className="font-display italic text-cream/70">
              <span className="text-cream">{filled}</span>
              <span className="text-ash"> {t('lobby.ofTaken')}</span>
            </div>
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {room.seats.map((s, i) => (
              <motion.li
                key={s.seat}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05, duration: 0.45 }}
                className={`relative plate px-5 py-4 flex items-center gap-4 ${
                  s.nickname ? '' : 'opacity-90'
                }`}
              >
                <div className="font-display italic text-brass text-3xl leading-none w-10 text-center">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="eyebrow text-ash">{t('lobby.seat')}</div>
                  <div className="font-display text-cream text-xl truncate">
                    {s.nickname ?? <span className="italic text-ash/70">{t('lobby.free')}</span>}
                  </div>
                </div>

                {s.nickname && (
                  <div className="flex flex-col items-end gap-1">
                    {s.isBot ? (
                      <span className="font-mono text-[10px] tracking-[0.25em] text-brass-hi">
                        {t('common.bot')}
                      </span>
                    ) : (
                      <span
                        className={`font-mono text-[10px] tracking-[0.25em] ${
                          s.connected ? 'text-brass' : 'text-ember-hi'
                        }`}
                      >
                        {s.connected ? '● ' + t('common.online') : '○ ' + t('common.offline')}
                      </span>
                    )}
                  </div>
                )}

                {!s.nickname && (
                  <button
                    onClick={() => void addBot(s.seat)}
                    className="btn-ghost py-1.5 px-3 text-[10px]"
                    title={t('lobby.addBot')}
                  >
                    + {t('lobby.addBot')}
                  </button>
                )}
              </motion.li>
            ))}
          </ul>

          <Flourish className="w-40 mx-auto text-brass/40 mb-6" />

          <button
            onClick={() => void start()}
            disabled={!allFilled}
            className="btn-brass w-full"
          >
            {allFilled ? t('lobby.start') : t('lobby.waiting', { n: 4 - filled })}
          </button>
          {!amHost && allFilled && (
            <div className="text-center font-display italic text-cream/50 text-xs mt-2">
              {t('lobby.hostWillStart')}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  )
}
