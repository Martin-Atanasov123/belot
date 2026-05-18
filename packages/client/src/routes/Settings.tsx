import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { PublicNav } from '../components/PublicNav.js'
import { Flourish, Monogram } from '../components/Ornaments.js'
import { useI18n, useT } from '../i18n/index.js'
import { getNickname, setNickname } from '../lib/identity.js'
import type { MessageKey } from '../i18n/bg.js'

// Settings page — per design spec §16 НАСТРОЙКИ.
// Tier A but minimal decoration (spec §16: "Tier A visuals (plate panels) but zero ornaments").
// Sidebar tabs (LG+) / top accordion (mobile).
//
// All preferences are stored in localStorage for now. The Account/Notifications
// tabs are disabled with "Sign up to enable" overlays until auth lands (Phase B).

type Tab = 'profile' | 'game' | 'notif' | 'account' | 'privacy'

const TABS: Array<{ id: Tab; labelKey: MessageKey; gated?: boolean }> = [
  { id: 'profile', labelKey: 'settings.profile' },
  { id: 'game',    labelKey: 'settings.game' },
  { id: 'notif',   labelKey: 'settings.notif',   gated: true },
  { id: 'account', labelKey: 'settings.account', gated: true },
  { id: 'privacy', labelKey: 'settings.privacy' },
]

export function Settings() {
  const t = useT()
  const [tab, setTab] = useState<Tab>('profile')

  return (
    <div className="min-h-screen bg-ink relative">
      <PublicNav />
      <div className="pointer-events-none absolute inset-0 bg-felt-noise opacity-40" />

      <main className="relative z-10 pt-20 sm:pt-24 pb-12 px-4 sm:px-6 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center mb-8"
        >
          <Monogram size={40} />
          <div className="eyebrow eyebrow-active mt-3">{t('settings.title')}</div>
          <h1 className="font-display italic text-cream text-3xl sm:text-4xl lg:text-5xl mt-2 leading-none">
            {t('settings.title')}
          </h1>
          <Flourish className="w-48 text-brass/40 mt-4" />
        </motion.div>

        {/* Mobile top tabs */}
        <div className="lg:hidden mb-5 overflow-x-auto -mx-4 px-4">
          <div className="flex gap-1 min-w-max">
            {TABS.map((s) => (
              <button
                key={s.id}
                onClick={() => setTab(s.id)}
                className={`relative shrink-0 px-3 py-2 font-mono text-[11px] tracking-[0.22em] uppercase transition ${
                  tab === s.id ? 'text-brass-hi' : 'text-ash hover:text-cream'
                }`}
              >
                {t(s.labelKey)}
                {tab === s.id && (
                  <motion.span
                    layoutId="settings-tab-underline-mobile"
                    className="absolute left-3 right-3 -bottom-px h-[2px] bg-brass"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop: sidebar + content */}
        <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-10">
          <aside className="hidden lg:block">
            <nav className="sticky top-24">
              <ol className="flex flex-col gap-1">
                {TABS.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => setTab(s.id)}
                      className={`group relative w-full text-left pl-3 py-2 font-display italic text-base transition ${
                        tab === s.id
                          ? 'text-brass-hi'
                          : 'text-cream/70 hover:text-cream'
                      }`}
                    >
                      {t(s.labelKey)}
                      {tab === s.id && (
                        <motion.span
                          layoutId="settings-tab-underline"
                          className="absolute left-0 top-0 bottom-0 w-[2px] bg-brass"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <section className="plate p-5 sm:p-7">
            {tab === 'profile' && <ProfileTab />}
            {tab === 'game' && <GameTab />}
            {tab === 'notif' && <GatedPanel />}
            {tab === 'account' && <GatedPanel />}
            {tab === 'privacy' && <PrivacyTab />}
          </section>
        </div>
      </main>
    </div>
  )
}

// ── Profile tab — nickname + avatar placeholder ─────────────────────
function ProfileTab() {
  const t = useT()
  const [nick, setNick] = useState(getNickname())
  const [saved, setSaved] = useState(false)
  const initial = (nick.trim()[0] ?? '?').toUpperCase()

  const onSave = () => {
    if (nick.trim()) {
      setNickname(nick.trim())
      setSaved(true)
      setTimeout(() => setSaved(false), 1200)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <div
          aria-hidden
          className="w-16 h-16 rounded-full border-2 border-brass/50 flex items-center justify-center font-display font-bold text-cream text-2xl bg-racing/60"
        >
          {initial}
        </div>
        <div>
          <div className="eyebrow">{t('settings.displayName')}</div>
          <div className="font-display italic text-cream text-xl mt-1">{nick || '—'}</div>
        </div>
      </div>

      <label className="block">
        <span className="eyebrow">{t('landing.nickname')}</span>
        <input
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          maxLength={20}
          className="input-salon w-full mt-2"
          placeholder={t('landing.nicknamePh')}
        />
      </label>

      <div className="flex items-center gap-3">
        <button onClick={onSave} className="btn-brass">
          {saved ? t('lobby.copied') : t('common.save')}
        </button>
      </div>
    </div>
  )
}

// ── Game tab — card back / sound / animations / language ────────────
const STORE_KEYS = {
  cardBack: 'belot.cardBack',
  sound: 'belot.sound',
  anim: 'belot.anim',
} as const

function readPref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // localStorage disabled — silent fail
  }
}

function GameTab() {
  const t = useT()
  const locale = useI18n((s) => s.locale)
  const setLocale = useI18n((s) => s.set)
  const [cardBack, setCardBack] = useState(() => readPref(STORE_KEYS.cardBack, 'default'))
  const [sound, setSound] = useState(() => readPref(STORE_KEYS.sound, 'on'))
  const [anim, setAnim] = useState(() => readPref(STORE_KEYS.anim, 'full'))

  useEffect(() => writePref(STORE_KEYS.cardBack, cardBack), [cardBack])
  useEffect(() => writePref(STORE_KEYS.sound, sound), [sound])
  useEffect(() => writePref(STORE_KEYS.anim, anim), [anim])

  return (
    <div className="flex flex-col gap-6">
      <RadioGroup
        label={t('settings.cardBack')}
        value={cardBack}
        onChange={setCardBack}
        options={[
          { value: 'default', label: t('settings.cardBackDefault') },
          { value: 'red', label: t('settings.cardBackRed') },
          { value: 'blue', label: t('settings.cardBackBlue') },
        ]}
      />

      <RadioGroup
        label={t('settings.sound')}
        value={sound}
        onChange={setSound}
        options={[
          { value: 'on', label: t('settings.soundOn') },
          { value: 'off', label: t('settings.soundOff') },
        ]}
      />

      <RadioGroup
        label={t('settings.anim')}
        value={anim}
        onChange={setAnim}
        options={[
          { value: 'full', label: t('settings.animFull') },
          { value: 'reduced', label: t('settings.animReduced') },
          { value: 'off', label: t('settings.animOff') },
        ]}
      />

      <RadioGroup
        label={t('settings.language')}
        value={locale}
        onChange={(v) => setLocale(v as 'bg' | 'en')}
        options={[
          { value: 'bg', label: 'Български' },
          { value: 'en', label: 'English' },
        ]}
      />
    </div>
  )
}

function RadioGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div>
      <div className="eyebrow mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`px-4 py-2 rounded font-mono text-[11px] tracking-[0.22em] uppercase border transition ${
                active
                  ? 'bg-brass/15 border-brass text-brass-hi'
                  : 'bg-transparent border-ash/30 text-ash hover:border-cream/50 hover:text-cream'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Gated panel — for notif / account tabs (need auth) ─────────────
function GatedPanel() {
  const t = useT()
  return (
    <div className="text-center py-10">
      <div className="font-display italic text-cream/55 mb-4">{t('settings.signUpToEnable')}</div>
      <a href="/registracia" className="btn-brass">
        {t('nav.signup')}
      </a>
    </div>
  )
}

// ── Privacy tab — minimal links ─────────────────────────────────────
function PrivacyTab() {
  const t = useT()
  return (
    <div className="space-y-4">
      <p className="font-display italic text-cream/75 leading-relaxed">{t('settings.privacyHint')}</p>
      <ul className="space-y-2">
        <li>
          <button disabled className="btn-ghost opacity-50">
            {t('settings.dataExport')}
          </button>
        </li>
        <li>
          <button disabled className="btn-ghost opacity-50">
            {t('settings.privacyPolicy')}
          </button>
        </li>
      </ul>
    </div>
  )
}
