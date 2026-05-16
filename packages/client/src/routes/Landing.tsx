import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { createRoom } from '../lib/api.js'
import { getNickname, getPlayerIdFor, setNickname } from '../lib/identity.js'
import { useT } from '../i18n/index.js'
import { Flourish, Monogram, CornerOrnament } from '../components/Ornaments.js'
import { LanguageToggle } from '../components/LanguageToggle.js'

export function Landing() {
  const t = useT()
  const nav = useNavigate()
  const [nick, setNick] = useState(getNickname())
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const persistNick = () => {
    const n = nick.trim()
    if (!n) {
      setError(t('landing.err.nickname'))
      return false
    }
    setNickname(n)
    return true
  }

  const onCreate = async () => {
    if (!persistNick()) return
    setBusy(true); setError(null)
    try {
      const { code } = await createRoom(getPlayerIdFor(nick.trim()))
      nav(`/r/${code}?host=1`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const onJoin = () => {
    if (!persistNick()) return
    const c = joinCode.trim().toUpperCase()
    if (!c) { setError(t('landing.err.code')); return }
    nav(`/r/${c}`)
  }

  return (
    <div className="min-h-screen bg-ink relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-felt-noise opacity-90" />
        <div
          className="absolute -top-40 -right-40 w-[640px] h-[640px] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #c9a25a 0%, transparent 60%)' }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-[640px] h-[640px] rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #7d1f2b 0%, transparent 60%)' }}
        />
      </div>

      <CornerOrnament className="absolute top-6 left-6 w-12 h-12 text-brass/40" />
      <CornerOrnament className="absolute top-6 right-6 w-12 h-12 text-brass/40" style={{ transform: 'scaleX(-1)' } as React.CSSProperties} />
      <CornerOrnament className="absolute bottom-6 left-6 w-12 h-12 text-brass/40" style={{ transform: 'scaleY(-1)' } as React.CSSProperties} />
      <CornerOrnament className="absolute bottom-6 right-6 w-12 h-12 text-brass/40" style={{ transform: 'scale(-1,-1)' } as React.CSSProperties} />

      <LanguageToggle className="absolute top-5 right-1/2 translate-x-1/2 lg:right-20 lg:translate-x-0 z-30" />

      <main className="relative z-10 min-h-screen grid lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col justify-between p-8 lg:p-16">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="flex items-center gap-3"
          >
            <Monogram size={42} />
            <div>
              <div className="eyebrow">{t('common.establ')}</div>
              <div className="font-display text-xl tracking-wide text-cream">Le Salon de Belot</div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.1, delay: 0.15 }}
            className="max-w-xl"
          >
            <div className="eyebrow text-brass mb-4">{t('landing.eyebrow')}</div>
            <motion.h1
              initial={{ opacity: 0, y: 12, letterSpacing: '0.4em' }}
              animate={{ opacity: 1, y: 0, letterSpacing: '0em' }}
              transition={{ duration: 1.2, delay: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
              className="font-display text-cream leading-[0.95]"
              style={{ fontSize: 'clamp(56px, 9vw, 124px)', fontWeight: 500 }}
            >
              Бѣлотъ
            </motion.h1>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.8 }}
              className="rule-brass mt-6 w-2/3"
            />
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.05, duration: 0.8 }}
              className="font-display italic text-smoke/80 mt-6 text-xl max-w-md"
            >
              {t('landing.tagline')}
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.35, duration: 0.8 }}
            className="hidden lg:flex items-end justify-between text-xs text-ash"
          >
            <div className="flex items-center gap-6">
              <div>
                <div className="eyebrow text-ash">{t('landing.deal')}</div>
                <div className="font-display italic text-cream/80 text-lg">{t('landing.dealValue')}</div>
              </div>
              <div>
                <div className="eyebrow text-ash">{t('landing.to')}</div>
                <div className="font-display italic text-cream/80 text-lg">{t('landing.toValue')}</div>
              </div>
              <div>
                <div className="eyebrow text-ash">{t('landing.game')}</div>
                <div className="font-display italic text-cream/80 text-lg">{t('landing.gameValue')}</div>
              </div>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-ash/70">{t('common.sofia')}</div>
          </motion.div>
        </section>

        <section className="relative flex items-center justify-center p-6 lg:p-16">
          <FannedCards />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-md plate p-8 md:p-10"
          >
            <div className="text-center mb-6">
              <div className="eyebrow text-brass">{t('landing.formTitle')}</div>
              <div className="rule-brass mt-3 w-1/2 mx-auto" />
            </div>

            <label className="block mb-5">
              <span className="eyebrow text-ash">{t('landing.nickname')}</span>
              <input
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                maxLength={20}
                className="input-salon w-full mt-2"
                placeholder={t('landing.nicknamePh')}
              />
            </label>

            <button onClick={onCreate} disabled={busy} className="btn-brass w-full mb-6">
              {busy ? t('landing.creating') : t('landing.create')}
            </button>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-brass/30" />
              <span className="font-display italic text-brass/70 text-sm">{t('landing.orJoin')}</span>
              <div className="flex-1 h-px bg-brass/30" />
            </div>

            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder={t('landing.codePh')}
                className="input-salon flex-1 font-mono text-center tracking-[0.4em] uppercase"
              />
              <button onClick={onJoin} className="btn-ghost">{t('landing.join')}</button>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-5 text-ember-hi text-center font-display italic"
              >
                {error}
              </motion.div>
            )}
          </motion.div>
        </section>
      </main>

      <Flourish className="absolute bottom-3 left-1/2 -translate-x-1/2 w-64 text-brass/40" />
    </div>
  )
}

function FannedCards() {
  const cards = [
    { rank: 'A', suit: '♠', red: false, rot: -22, x: -120, y: 18 },
    { rank: 'K', suit: '♥', red: true,  rot: -10, x: -55,  y: -8 },
    { rank: 'Q', suit: '♦', red: true,  rot:   2, x:   18, y: -16 },
    { rank: 'J', suit: '♣', red: false, rot:  14, x:   90, y: -2 },
    { rank: '10', suit: '♥', red: true, rot:  26, x:  160, y: 28 },
  ]
  return (
    <div
      aria-hidden
      className="hidden lg:block absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 opacity-90 pointer-events-none"
      style={{ filter: 'drop-shadow(0 30px 40px rgba(0,0,0,.55))' }}
    >
      {cards.map((c, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: -40, rotate: c.rot - 8 }}
          animate={{ opacity: 1, y: c.y, rotate: c.rot, x: c.x }}
          transition={{ delay: 0.4 + i * 0.07, duration: 0.9, ease: [0.22, 0.61, 0.36, 1] }}
          className="absolute"
          style={{ left: '50%', top: '50%' }}
        >
          <div
            className={`card-face ${c.red ? 'is-red' : ''}`}
            style={{ pointerEvents: 'none', width: 84, height: 122 }}
          >
            <div className="corner corner-top"><span className="rank">{c.rank}</span><span className="suit">{c.suit}</span></div>
            <div className="pip" style={{ fontSize: '2.2rem' }}>{c.suit}</div>
            <div className="corner corner-bot"><span className="rank">{c.rank}</span><span className="suit">{c.suit}</span></div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
