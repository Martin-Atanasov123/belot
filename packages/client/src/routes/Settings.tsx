import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PublicNav } from '../components/PublicNav.js'
import { Flourish, Monogram } from '../components/Ornaments.js'
import { useI18n, useT } from '../i18n/index.js'
import { getNickname, setNickname } from '../lib/identity.js'
import { useAuth } from '../lib/auth.js'
import { supabase } from '../lib/supabase.js'
import { deleteAccount } from '../lib/api.js'
import {
  NOTIF_KEYS,
  enableTurnAlerts,
  notificationPermission,
  readNotifPref,
  writeNotifPref,
} from '../lib/notify.js'
import type { MessageKey } from '../i18n/bg.js'

// Settings page — per design spec §16 НАСТРОЙКИ.
// Tier A but minimal decoration (spec §16: "Tier A visuals (plate panels) but zero ornaments").
// Sidebar tabs (LG+) / top accordion (mobile).
//
// All preferences are stored in localStorage for now. The Account/Notifications
// tabs are disabled with "Sign up to enable" overlays until auth lands (Phase B).

type Tab = 'profile' | 'game' | 'notif' | 'account' | 'privacy'

const TABS: Array<{ id: Tab; labelKey: MessageKey }> = [
  { id: 'profile', labelKey: 'settings.profile' },
  { id: 'game',    labelKey: 'settings.game' },
  { id: 'notif',   labelKey: 'settings.notif' },
  { id: 'account', labelKey: 'settings.account' },
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
            {tab === 'notif' && <NotificationsTab />}
            {tab === 'account' && <AccountTab />}
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
  const profile = useAuth((s) => s.profile)
  const userId = useAuth((s) => s.user?.id ?? null)
  const refreshProfile = useAuth((s) => s.refreshProfile)
  // Prefer DB username when signed in; fall back to localStorage.
  const [nick, setNick] = useState(profile?.username ?? getNickname())
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const initial = (nick.trim()[0] ?? '?').toUpperCase()

  // Sync input when the auth profile loads (e.g. on first render after OAuth).
  useEffect(() => {
    if (profile?.username) setNick(profile.username)
  }, [profile?.username])

  const [saving, setSaving] = useState(false)

  const onSave = async () => {
    const trimmed = nick.trim()
    if (!trimmed) return
    setErr(null)
    if (!/^[A-Za-z0-9_.-]{3,20}$/.test(trimmed)) {
      setErr(t('auth.usernameHint'))
      return
    }
    // No-op if unchanged — avoids a needless round-trip and a false "taken".
    if (profile?.username === trimmed) {
      setNickname(trimmed)
      setSaved(true)
      setTimeout(() => setSaved(false), 1200)
      return
    }
    // Always persist to localStorage for guest/offline nickname.
    setNickname(trimmed)
    // Also update public.profiles when signed in.
    if (userId) {
      setSaving(true)
      // Pre-check availability so the user gets a friendly message instead of a
      // raw "duplicate key value violates unique constraint" Postgres error.
      // The username unique constraint is exact-case, so an exact match is what
      // would collide.
      const { data: taken, error: checkErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', trimmed)
        .neq('id', userId)
        .maybeSingle()
      if (checkErr) {
        setSaving(false)
        setErr(checkErr.message)
        return
      }
      if (taken) {
        setSaving(false)
        setErr(t('settings.usernameTaken'))
        return
      }
      const { error } = await supabase
        .from('profiles')
        .update({ username: trimmed, updated_at: new Date().toISOString() })
        .eq('id', userId)
      setSaving(false)
      if (error) {
        // 23505 = unique_violation (lost a race between the check and the update).
        setErr(error.code === '23505' ? t('settings.usernameTaken') : error.message)
        return
      }
      await refreshProfile()
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
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
        <button onClick={() => void onSave()} disabled={saving} className="btn-brass">
          {saving ? '…' : saved ? t('lobby.copied') : t('common.save')}
        </button>
      </div>
      {err && (
        <div className="text-ember-hi font-display italic text-sm">{err}</div>
      )}
      {userId && (
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-brass/60">
          {t('settings.syncedToAccount')}
        </div>
      )}
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

// ── Sign-up CTA — shown on auth-gated tabs when signed out ─────────
function SignUpCTA() {
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

// ── Notifications tab — browser turn alerts + sound (no backend) ────
function NotificationsTab() {
  const t = useT()
  const [turn, setTurn] = useState(() => readNotifPref(NOTIF_KEYS.turn))
  const [sound, setSound] = useState(() => readNotifPref(NOTIF_KEYS.sound))
  const [perm, setPerm] = useState(() => notificationPermission())

  const onToggleTurn = async () => {
    if (turn) {
      writeNotifPref(NOTIF_KEYS.turn, false)
      setTurn(false)
      return
    }
    const result = await enableTurnAlerts()
    setPerm(result === 'unsupported' ? 'denied' : result)
    if (result === 'granted') {
      writeNotifPref(NOTIF_KEYS.turn, true)
      setTurn(true)
    }
  }

  const onToggleSound = () => {
    const next = !sound
    writeNotifPref(NOTIF_KEYS.sound, next)
    setSound(next)
  }

  return (
    <div className="flex flex-col gap-6">
      <ToggleRow
        label={t('settings.notifTurn')}
        hint={t('settings.notifTurnHint')}
        on={turn}
        onToggle={() => void onToggleTurn()}
      />
      {perm === 'denied' && (
        <div className="text-ember-hi font-display italic text-sm -mt-3">
          {t('settings.notifBlocked')}
        </div>
      )}
      <ToggleRow
        label={t('settings.notifSound')}
        hint={t('settings.notifSoundHint')}
        on={sound}
        onToggle={onToggleSound}
      />
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  on,
  onToggle,
}: {
  label: string
  hint?: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="font-display italic text-cream text-base">{label}</div>
        {hint && <div className="font-mono text-[10px] tracking-[0.12em] text-ash mt-1">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className={`shrink-0 w-12 h-7 rounded-full border transition relative ${
          on ? 'bg-brass/30 border-brass' : 'bg-ink/60 border-ash/30'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${
            on ? 'left-6 bg-brass-hi' : 'left-0.5 bg-ash'
          }`}
        />
      </button>
    </div>
  )
}

// ── Account tab — change password / email, delete account ──────────
function AccountTab() {
  const t = useT()
  const status = useAuth((s) => s.status)
  const session = useAuth((s) => s.session)
  const user = useAuth((s) => s.user)
  const profile = useAuth((s) => s.profile)
  const signOut = useAuth((s) => s.signOut)
  const nav = useNavigate()

  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pwBusy, setPwBusy] = useState(false)

  const [email, setEmail] = useState('')
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [emailBusy, setEmailBusy] = useState(false)

  const [confirmText, setConfirmText] = useState('')
  const [delBusy, setDelBusy] = useState(false)
  const [delErr, setDelErr] = useState<string | null>(null)

  if (status === 'loading') return null
  if (!session || !user) return <SignUpCTA />

  const onChangePassword = async () => {
    setPwMsg(null)
    if (pw.length < 8) return setPwMsg({ ok: false, text: t('settings.pwTooShort') })
    if (pw !== pw2) return setPwMsg({ ok: false, text: t('settings.pwMismatch') })
    setPwBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setPwBusy(false)
    if (error) return setPwMsg({ ok: false, text: error.message })
    setPw('')
    setPw2('')
    setPwMsg({ ok: true, text: t('settings.pwChanged') })
  }

  const onChangeEmail = async () => {
    setEmailMsg(null)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return setEmailMsg({ ok: false, text: t('settings.emailInvalid') })
    }
    setEmailBusy(true)
    const { error } = await supabase.auth.updateUser({ email })
    setEmailBusy(false)
    if (error) return setEmailMsg({ ok: false, text: error.message })
    setEmail('')
    setEmailMsg({ ok: true, text: t('settings.emailConfirmSent') })
  }

  const canDelete = confirmText.trim() === (profile?.username ?? '') && !!profile?.username
  const onDelete = async () => {
    if (!canDelete) return
    setDelErr(null)
    setDelBusy(true)
    const token = session.access_token
    const r = await deleteAccount(token)
    if (!r.ok) {
      setDelBusy(false)
      setDelErr(r.error ?? 'failed')
      return
    }
    await signOut()
    nav('/')
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Change password */}
      <section className="flex flex-col gap-3">
        <div className="eyebrow eyebrow-active">{t('settings.changePassword')}</div>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder={t('settings.newPassword')}
          className="input-salon w-full"
          autoComplete="new-password"
        />
        <input
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          placeholder={t('settings.confirmPassword')}
          className="input-salon w-full"
          autoComplete="new-password"
        />
        <div>
          <button onClick={() => void onChangePassword()} disabled={pwBusy} className="btn-brass">
            {pwBusy ? '…' : t('settings.updatePassword')}
          </button>
        </div>
        {pwMsg && (
          <div className={`font-display italic text-sm ${pwMsg.ok ? 'text-brass-hi' : 'text-ember-hi'}`}>
            {pwMsg.text}
          </div>
        )}
      </section>

      {/* Change email */}
      <section className="flex flex-col gap-3 pt-6 border-t border-brass/15">
        <div className="eyebrow eyebrow-active">{t('settings.changeEmail')}</div>
        <div className="font-mono text-[10px] tracking-[0.12em] text-ash">
          {t('settings.currentEmail')}: {user.email ?? '—'}
        </div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('settings.newEmail')}
          className="input-salon w-full"
          autoComplete="email"
        />
        <div>
          <button onClick={() => void onChangeEmail()} disabled={emailBusy} className="btn-brass">
            {emailBusy ? '…' : t('settings.updateEmail')}
          </button>
        </div>
        {emailMsg && (
          <div className={`font-display italic text-sm ${emailMsg.ok ? 'text-brass-hi' : 'text-ember-hi'}`}>
            {emailMsg.text}
          </div>
        )}
      </section>

      {/* Delete account */}
      <section className="flex flex-col gap-3 pt-6 border-t border-ember/30">
        <div className="eyebrow text-ember-hi">{t('settings.dangerZone')}</div>
        <p className="font-display italic text-cream/70 text-sm leading-relaxed">
          {t('settings.deleteWarning')}
        </p>
        <label className="block">
          <span className="font-mono text-[10px] tracking-[0.12em] text-ash">
            {t('settings.deleteConfirmLabel', { name: profile?.username ?? '' })}
          </span>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={profile?.username ?? ''}
            className="input-salon w-full mt-2"
          />
        </label>
        <div>
          <button
            onClick={() => void onDelete()}
            disabled={!canDelete || delBusy}
            className="px-5 py-2.5 rounded font-mono text-[11px] tracking-[0.22em] uppercase border border-ember bg-ember/20 text-ember-hi transition hover:bg-ember/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {delBusy ? '…' : t('settings.deleteAccount')}
          </button>
        </div>
        {delErr && <div className="font-display italic text-ember-hi text-sm">{delErr}</div>}
      </section>
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
