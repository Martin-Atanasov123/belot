import { useState } from 'react'
import { motion } from 'framer-motion'
import { useT } from '../i18n/index.js'
import { Flourish, Monogram, CornerOrnament } from './Ornaments.js'
import { LanguageToggle } from './LanguageToggle.js'

export function JoinForm({
  code,
  initialNick,
  onSubmit,
  onSpectate,
}: {
  code: string
  initialNick: string
  onSubmit: (nick: string) => void
  onSpectate?: (nick: string) => void
}) {
  const t = useT()
  const [nick, setNick] = useState(initialNick)
  const [err, setErr] = useState<string | null>(null)

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault()
    const n = nick.trim()
    if (!n) {
      setErr(t('landing.err.nickname'))
      return
    }
    onSubmit(n)
  }
  const spectate = () => {
    const n = nick.trim()
    if (!n) { setErr(t('landing.err.nickname')); return }
    onSpectate?.(n)
  }

  return (
    <div className="min-h-screen bg-ink relative overflow-hidden flex items-center justify-center p-6">
      <div className="pointer-events-none absolute inset-0 bg-felt-noise opacity-90" />
      <CornerOrnament className="absolute top-5 left-5 w-10 h-10 text-brass/40" />
      <CornerOrnament className="absolute top-5 right-5 w-10 h-10 text-brass/40" style={{ transform: 'scaleX(-1)' } as React.CSSProperties} />

      <LanguageToggle className="absolute top-5 right-5 lg:right-20 z-30" />

      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md plate p-8 md:p-10"
      >
        <div className="flex flex-col items-center mb-4">
          <Monogram size={42} />
          <div className="eyebrow text-brass mt-3">{t('room.joinTitle')}</div>
          <div className="rule-brass mt-3 w-2/3" />
        </div>

        <div className="text-center mb-6">
          <div className="eyebrow text-ash">{t('room.code')}</div>
          <div className="font-mono text-2xl text-brass tracking-[0.32em] mt-1">{code}</div>
        </div>

        <p className="text-center font-display italic text-cream/70 mb-5">{t('room.joinSub')}</p>

        <label className="block mb-5">
          <span className="eyebrow text-ash">{t('landing.nickname')}</span>
          <input
            autoFocus
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            maxLength={20}
            className="input-salon w-full mt-2"
            placeholder={t('landing.nicknamePh')}
          />
        </label>

        <button type="submit" className="btn-brass w-full">
          {t('room.joinBtn')}
        </button>

        {onSpectate && (
          <button type="button" onClick={spectate} className="btn-ghost w-full mt-3">
            {t('room.spectateBtn')}
          </button>
        )}

        {err && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 text-ember-hi text-center font-display italic"
          >
            {err}
          </motion.div>
        )}

        <Flourish className="w-40 mx-auto mt-6 text-brass/40" />
      </motion.form>
    </div>
  )
}
