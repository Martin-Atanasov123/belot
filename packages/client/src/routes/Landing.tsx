import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
    if (!n) { setError(t('landing.err.nickname')); return false }
    setNickname(n)
    return true
  }
  const onCreate = async () => {
    if (!persistNick()) return
    setBusy(true); setError(null)
    try {
      const { code } = await createRoom(getPlayerIdFor(nick.trim()))
      nav(`/r/${code}?host=1`)
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  const onJoin = () => {
    if (!persistNick()) return
    const c = joinCode.trim().toUpperCase()
    if (!c) { setError(t('landing.err.code')); return }
    nav(`/r/${c}`)
  }

  return (
    <div className="min-h-screen bg-ink relative">
      {/* Atmospheric background */}
      <div className="pointer-events-none fixed inset-0">
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

      <LanguageToggle className="fixed top-5 right-5 z-30" />

      {/* ─── HERO ─── */}
      <section className="relative min-h-[100dvh] grid lg:grid-cols-[1.05fr_0.95fr]">
        <CornerOrnament className="absolute top-6 left-6 w-12 h-12 text-brass/40" />
        <CornerOrnament className="absolute top-6 right-6 w-12 h-12 text-brass/40" style={{ transform: 'scaleX(-1)' } as React.CSSProperties} />

        <div className="flex flex-col justify-between p-6 sm:p-10 lg:p-16">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="flex items-center gap-3"
          >
            <Monogram size={42} />
            <div>
              <div className="eyebrow">{t('common.establ')}</div>
              <div className="font-display text-xl tracking-wide text-cream font-semibold">Le Salon de Belot</div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.0, delay: 0.1 }}
            className="max-w-xl pt-8 lg:pt-0"
          >
            <div className="eyebrow text-brass mb-4">{t('landing.eyebrow')}</div>
            <motion.h1
              initial={{ opacity: 0, y: 12, letterSpacing: '0.18em' }}
              animate={{ opacity: 1, y: 0, letterSpacing: '0em' }}
              transition={{ duration: 1.0, delay: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
              className="font-display text-cream leading-[0.95] font-bold"
              style={{ fontSize: 'clamp(64px, 10vw, 144px)' }}
            >
              Белот
            </motion.h1>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.7 }}
              className="rule-brass mt-6 w-2/3"
            />
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85, duration: 0.7 }}
              className="font-display text-smoke/90 mt-6 text-lg sm:text-xl max-w-md font-medium"
            >
              {t('landing.tagline')}
            </motion.p>

            {/* Trust line — three concrete differentiators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.05, duration: 0.6 }}
              className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs sm:text-sm text-ash"
            >
              <TrustItem label={t('landing.trustFree')} />
              <TrustItem label={t('landing.trustNoAds')} />
              <TrustItem label={t('landing.trustPwa')} />
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.7 }}
            className="hidden lg:flex items-end justify-between text-xs text-ash pt-8"
          >
            <div className="flex items-center gap-6">
              <FactCol label={t('landing.deal')} value={t('landing.dealValue')} />
              <FactCol label={t('landing.to')} value={t('landing.toValue')} />
              <FactCol label={t('landing.game')} value={t('landing.gameValue')} />
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-ash/70">{t('common.sofia')}</div>
          </motion.div>
        </div>

        {/* Right column — form (the primary CTA) */}
        <div className="relative flex items-center justify-center p-6 sm:p-10 lg:p-16">
          <FannedCards />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.7, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-md plate p-7 md:p-10"
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

            <button onClick={onCreate} disabled={busy} className="btn-brass w-full mb-6 text-base py-3.5">
              {busy ? t('landing.creating') : t('landing.create')}
            </button>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-brass/30" />
              <span className="font-display text-brass/70 text-sm font-medium">{t('landing.orJoin')}</span>
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
                className="mt-5 text-ember-hi text-center font-display font-medium"
              >
                {error}
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Scroll hint */}
        <motion.a
          href="#features"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.6 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center text-brass/70 hover:text-brass-hi transition group"
        >
          <span className="eyebrow text-[9px]">{t('landing.scroll')}</span>
          <motion.span
            aria-hidden
            animate={{ y: [0, 4, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
            className="mt-1 text-lg"
          >
            ⌄
          </motion.span>
        </motion.a>
      </section>

      {/* ─── FEATURES STRIP ─── */}
      <section id="features" className="relative py-16 sm:py-24 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <SectionHead eyebrow={t('landing.featuresEyebrow')} title={t('landing.featuresTitle')} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5 mt-10">
            <FeatureCard glyph="⚡" title={t('landing.f1Title')} body={t('landing.f1Body')} />
            <FeatureCard glyph="♣" title={t('landing.f2Title')} body={t('landing.f2Body')} />
            <FeatureCard glyph="◐" title={t('landing.f3Title')} body={t('landing.f3Body')} />
            <FeatureCard glyph="✦" title={t('landing.f4Title')} body={t('landing.f4Body')} />
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="relative py-16 sm:py-24 px-4 sm:px-8 border-t border-brass/15">
        <div className="max-w-5xl mx-auto">
          <SectionHead eyebrow={t('landing.howEyebrow')} title={t('landing.howTitle')} />
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8 mt-10">
            <Step n={1} title={t('landing.step1Title')} body={t('landing.step1Body')} />
            <Step n={2} title={t('landing.step2Title')} body={t('landing.step2Body')} />
            <Step n={3} title={t('landing.step3Title')} body={t('landing.step3Body')} />
          </ol>
        </div>
      </section>

      {/* ─── PWA highlight ─── */}
      <section className="relative py-16 sm:py-24 px-4 sm:px-8 border-t border-brass/15">
        <div className="max-w-5xl mx-auto grid md:grid-cols-[1.2fr_1fr] gap-8 sm:gap-12 items-center">
          <div>
            <SectionHead eyebrow={t('landing.pwaEyebrow')} title={t('landing.pwaTitle')} align="left" />
            <p className="font-display text-cream/85 text-lg sm:text-xl mt-6 max-w-md font-medium leading-snug">
              {t('landing.pwaBody')}
            </p>
            <ul className="mt-5 space-y-1.5 text-cream/75 text-sm sm:text-base">
              <li>· {t('landing.pwa1')}</li>
              <li>· {t('landing.pwa2')}</li>
              <li>· {t('landing.pwa3')}</li>
            </ul>
          </div>
          <div className="flex items-center justify-center">
            <PhonePreview />
          </div>
        </div>
      </section>

      {/* ─── FAQ-LITE / closing CTA ─── */}
      <section className="relative py-16 sm:py-24 px-4 sm:px-8 border-t border-brass/15">
        <div className="max-w-3xl mx-auto text-center">
          <SectionHead eyebrow={t('landing.closingEyebrow')} title={t('landing.closingTitle')} />
          <p className="font-display text-cream/85 text-lg sm:text-xl mt-6 max-w-2xl mx-auto leading-snug font-medium">
            {t('landing.closingBody')}
          </p>
          <button onClick={onCreate} className="btn-brass mt-8 px-10 py-4 text-base">
            {t('landing.create')}
          </button>
          <div className="mt-4">
            <Link to="/rules" className="font-display text-brass/80 hover:text-brass-hi text-sm">
              {t('landing.rulesLink')} →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="relative border-t border-brass/15 py-7 sm:py-10 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-3 text-xs">
          <div className="flex items-center gap-3 text-ash">
            <Monogram size={24} />
            <div>
              <div className="font-display text-cream/85 font-semibold">Le Salon de Belot</div>
              <div className="font-mono text-[10px] tracking-widest text-ash/70 uppercase">{t('common.sofia')}</div>
            </div>
          </div>
          <nav className="flex items-center gap-5 text-ash">
            <Link to="/rules" className="hover:text-brass-hi transition">{t('landing.rulesLink')}</Link>
            <a
              href="https://github.com/atanasovm-source/belot"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brass-hi transition"
            >
              GitHub
            </a>
            <span className="font-mono text-[10px] tracking-widest text-ash/60">v1.0</span>
          </nav>
        </div>
        <Flourish className="w-40 mx-auto mt-6 text-brass/40" />
      </footer>
    </div>
  )
}

// ── Layout primitives ──────────────────────────────────────────────

function TrustItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-brass-hi text-[10px]">✓</span>
      <span>{label}</span>
    </div>
  )
}

function FactCol({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow text-ash">{label}</div>
      <div className="font-display text-cream/85 text-lg font-medium">{value}</div>
    </div>
  )
}

function SectionHead({ eyebrow, title, align = 'center' }: { eyebrow: string; title: string; align?: 'center' | 'left' }) {
  const a = align === 'center' ? 'text-center items-center' : 'text-left items-start'
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6 }}
      className={`flex flex-col gap-2 ${a}`}
    >
      <div className="eyebrow text-brass">{eyebrow}</div>
      <h2 className="font-display text-cream text-3xl sm:text-5xl font-bold leading-tight">{title}</h2>
      <div className={`rule-brass w-32 ${align === 'center' ? '' : 'self-start'}`} />
    </motion.div>
  )
}

function FeatureCard({ glyph, title, body }: { glyph: string; title: string; body: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5 }}
      className="plate p-4 sm:p-5 flex flex-col gap-2"
    >
      <div className="text-brass-hi text-2xl sm:text-3xl leading-none font-display">{glyph}</div>
      <div className="font-display text-cream text-lg sm:text-xl font-bold leading-tight">{title}</div>
      <div className="text-ash text-xs sm:text-sm leading-relaxed">{body}</div>
    </motion.div>
  )
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay: (n - 1) * 0.08 }}
      className="plate p-5 sm:p-6 relative"
    >
      <div className="font-display text-brass-hi text-5xl sm:text-6xl leading-none font-bold opacity-90 mb-2">
        {n}
      </div>
      <div className="font-display text-cream text-xl font-bold mb-1">{title}</div>
      <div className="text-ash text-sm leading-relaxed">{body}</div>
    </motion.li>
  )
}

// ── Decorative phone-frame preview for the PWA section ──
function PhonePreview() {
  return (
    <div
      aria-hidden
      className="relative w-[220px] sm:w-[260px] h-[460px] sm:h-[520px] rounded-[36px] border border-brass/35 p-2 shadow-2xl"
      style={{ background: 'linear-gradient(180deg, #1a1a1a, #050505)' }}
    >
      <div
        className="absolute inset-2 rounded-[28px] overflow-hidden flex flex-col"
        style={{
          background:
            'radial-gradient(circle at 50% 30%, rgba(28,82,64,.9), rgba(14,37,28,.95) 70%, rgba(7,18,14,1) 100%)',
        }}
      >
        {/* faux status bar */}
        <div className="flex justify-between items-center px-4 pt-2 text-[8px] font-mono text-cream/60">
          <span>9:41</span>
          <span>● ● ●</span>
        </div>
        {/* faux top bar */}
        <div className="px-4 py-2 mt-1 flex items-center justify-between border-b border-brass/25">
          <div className="font-mono text-brass text-[10px] tracking-widest">ABC123</div>
          <div className="font-mono text-cream text-[10px]">42 : 38</div>
        </div>
        {/* felt circle */}
        <div className="flex-1 flex items-center justify-center">
          <div
            className="rounded-full border border-brass/30"
            style={{
              width: 130,
              height: 130,
              background:
                'radial-gradient(circle, rgba(28,82,64,.9), rgba(7,18,14,1))',
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              {/* mini cards in cross */}
              <MiniCard rank="J" suit="♥" red rotate={-2} dy={26} dx={0} />
              <MiniCard rank="A" suit="♠" rotate={-8} dx={-30} dy={0} />
              <MiniCard rank="9" suit="♦" red rotate={180} dx={0} dy={-26} />
            </div>
          </div>
        </div>
        {/* hand */}
        <div className="flex justify-center pb-4 -mt-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <MiniCard
              key={i}
              rank={['7', '9', 'J', 'Q', 'A'][i]!}
              suit={['♣', '♠', '♥', '♦', '♠'][i]!}
              red={i === 2 || i === 3}
              rotate={(i - 2) * 6}
              dx={(i - 2) * 14}
              dy={Math.abs(i - 2) * 3}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function MiniCard({ rank, suit, red, rotate, dx, dy }: { rank: string; suit: string; red?: boolean; rotate: number; dx: number; dy: number }) {
  return (
    <div
      className="absolute rounded-md shadow-lg border border-stone-400/50"
      style={{
        width: 26, height: 36,
        background: 'linear-gradient(180deg, #fbf5e0, #f1e6c1)',
        color: red ? '#7d1f2b' : '#161616',
        transform: `translate(${dx}px, ${dy}px) rotate(${rotate}deg)`,
        padding: '2px 3px',
        fontFamily: '"Playfair Display", serif',
        fontSize: 9,
        fontWeight: 700,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <span>{rank}</span>
      <span style={{ fontSize: 11, lineHeight: 1, alignSelf: 'center' }}>{suit}</span>
      <span style={{ transform: 'rotate(180deg)', alignSelf: 'flex-end' }}>{rank}</span>
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
