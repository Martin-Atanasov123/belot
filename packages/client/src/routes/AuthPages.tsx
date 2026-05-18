import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PublicNav } from '../components/PublicNav.js'
import { Monogram } from '../components/Ornaments.js'
import { useT } from '../i18n/index.js'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.js'
import type { MessageKey } from '../i18n/bg.js'

function authErrorKey(message: string | undefined): MessageKey {
  const m = (message ?? '').toLowerCase()
  if (m.includes('invalid login') || m.includes('invalid_credentials')) return 'auth.invalidLogin'
  if (m.includes('already registered') || m.includes('user_already_exists')) return 'auth.userExists'
  if (m.includes('password') && (m.includes('weak') || m.includes('short'))) return 'auth.weakPassword'
  if (m.includes('fetch') || m.includes('network')) return 'auth.networkErr'
  if (m.includes('email not confirmed')) return 'auth.emailNotConfirmed'
  return 'common.error'
}

function AuthShell({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-ink relative flex flex-col">
      <PublicNav />
      <div className="absolute inset-0 bg-felt-noise opacity-80 pointer-events-none" />
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-24">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md plate p-6 sm:p-8"
        >
          <div className="flex flex-col items-center mb-5">
            <Monogram size={42} />
            <h1 className="font-display italic text-cream text-2xl sm:text-3xl mt-3 text-center">
              {title}
            </h1>
            <div className="rule-brass mt-3 w-1/2" />
          </div>
          {children}
        </motion.div>
      </main>
    </div>
  )
}

// ─── Login ─────────────────────────────────────────────────────────────
export function Login() {
  const t = useT()
  const nav = useNavigate()
  const session = useAuth((s) => s.session)
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [err, setErr] = useState<MessageKey | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (session) nav('/tablo', { replace: true })
  }, [session, nav])

  const validate = (): MessageKey | null => {
    if (!email.trim()) return 'common.required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'auth.invalidEmail'
    if (!pwd) return 'common.required'
    return null
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const v = validate()
    if (v) { setErr(v); return }
    if (!isSupabaseConfigured) { setErr('auth.notConfigured'); return }
    setErr(null)
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pwd,
    })
    setBusy(false)
    if (error) { setErr(authErrorKey(error.message)); return }
    nav('/tablo', { replace: true })
  }

  const oauth = async (provider: 'google' | 'facebook') => {
    if (!isSupabaseConfigured) { setErr('auth.notConfigured'); return }
    setErr(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/tablo` },
    })
    if (error) setErr(authErrorKey(error.message))
  }

  return (
    <AuthShell title={t('auth.loginTitle')}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label={t('auth.email')} type="email" value={email} onChange={setEmail} autoComplete="email" />
        <PasswordField label={t('auth.password')} value={pwd} onChange={setPwd} show={showPwd} onToggle={() => setShowPwd((s) => !s)} autoComplete="current-password" />
        <div className="text-right">
          <Link to="/forgot-password" className="font-mono text-[11px] tracking-[0.18em] uppercase text-ash hover:text-brass-hi">
            {t('auth.forgot')}
          </Link>
        </div>
        {err && <ErrorMsg msg={t(err)} />}
        <button type="submit" disabled={busy} className="btn-brass w-full disabled:opacity-60">
          {busy ? t('auth.signingIn') : t('auth.loginBtn')}
        </button>
        <OAuthDivider />
        <OAuthButtons onGoogle={() => void oauth('google')} onFacebook={() => void oauth('facebook')} />
        <div className="text-center text-sm font-display italic text-ash mt-3">
          {t('auth.noAccount')}{' '}
          <Link to="/registracia" className="text-brass-hi hover:underline">{t('auth.signupBtn')}</Link>
        </div>
      </form>
    </AuthShell>
  )
}

// ─── Signup ────────────────────────────────────────────────────────────
export function Signup() {
  const t = useT()
  const nav = useNavigate()
  const session = useAuth((s) => s.session)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [showPwd2, setShowPwd2] = useState(false)
  const [accept, setAccept] = useState(false)
  const [err, setErr] = useState<MessageKey | null>(null)
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (session) nav('/tablo', { replace: true })
  }, [session, nav])

  const validate = (): MessageKey | null => {
    if (!username.trim() || !email.trim() || !pwd) return 'common.required'
    if (!/^[A-Za-z0-9_.-]{3,20}$/.test(username.trim())) return 'auth.usernameHint'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'auth.invalidEmail'
    if (pwd.length < 8) return 'common.passwordShort'
    if (pwd !== pwd2) return 'common.passwordMismatch'
    if (!accept) return 'auth.mustAcceptTerms'
    return null
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const v = validate()
    if (v) { setErr(v); return }
    if (!isSupabaseConfigured) { setErr('auth.notConfigured'); return }
    setErr(null)
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: pwd,
      options: {
        data: { username: username.trim() },
        emailRedirectTo: `${window.location.origin}/tablo`,
      },
    })
    setBusy(false)
    if (error) { setErr(authErrorKey(error.message)); return }
    if (data.session) {
      nav('/tablo', { replace: true })
    } else {
      setSuccess(true)
    }
  }

  const oauth = async (provider: 'google' | 'facebook') => {
    if (!isSupabaseConfigured) { setErr('auth.notConfigured'); return }
    setErr(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/tablo` },
    })
    if (error) setErr(authErrorKey(error.message))
  }

  if (success) {
    return (
      <AuthShell title={t('auth.signupTitle')}>
        <div className="text-center py-4 space-y-3">
          <div className="text-4xl">✉</div>
          <div className="font-display italic text-brass-hi text-lg">{t('auth.signupSuccess')}</div>
          <div className="font-display italic text-cream/70 text-sm">{t('auth.signupSuccessHint')}</div>
          <Link to="/vhod" className="btn-brass inline-block mt-4">{t('auth.loginBtn')}</Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title={t('auth.signupTitle')}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label={t('auth.username')} value={username} onChange={setUsername} hint={t('auth.usernameHint')} autoComplete="username" />
        <Field label={t('auth.email')} type="email" value={email} onChange={setEmail} autoComplete="email" />
        <PasswordField label={t('auth.password')} value={pwd} onChange={setPwd} show={showPwd} onToggle={() => setShowPwd((s) => !s)} autoComplete="new-password" hint={t('auth.passwordHint')} />
        <PasswordField label={t('auth.passwordConfirm')} value={pwd2} onChange={setPwd2} show={showPwd2} onToggle={() => setShowPwd2((s) => !s)} autoComplete="new-password" />
        <label className="flex items-start gap-2 text-xs text-cream/80 cursor-pointer">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 accent-brass" />
          <span className="font-display italic">{t('auth.acceptTerms')}</span>
        </label>
        {err && <ErrorMsg msg={t(err)} />}
        <button type="submit" disabled={busy} className="btn-brass w-full disabled:opacity-60">
          {busy ? t('auth.signingUp') : t('auth.signupBtn')}
        </button>
        <OAuthDivider />
        <OAuthButtons onGoogle={() => void oauth('google')} onFacebook={() => void oauth('facebook')} />
        <div className="text-center text-sm font-display italic text-ash mt-3">
          {t('auth.haveAccount')}{' '}
          <Link to="/vhod" className="text-brass-hi hover:underline">{t('auth.loginBtn')}</Link>
        </div>
      </form>
    </AuthShell>
  )
}

// ─── Forgot password ───────────────────────────────────────────────────
export function ForgotPassword() {
  const t = useT()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<MessageKey | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setErr('common.required'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErr('auth.invalidEmail'); return }
    if (!isSupabaseConfigured) { setErr('auth.notConfigured'); return }
    setErr(null)
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setBusy(false)
    if (error) { setErr(authErrorKey(error.message)); return }
    setSent(true)
  }

  return (
    <AuthShell title={t('auth.forgotTitle')}>
      <p className="text-center font-display italic text-cream/70 mb-5 text-sm">{t('auth.forgotBody')}</p>
      {sent ? (
        <div className="text-center space-y-3 py-2">
          <div className="text-3xl">✉</div>
          <div className="text-brass-hi font-display italic">{t('auth.forgotSent')}</div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label={t('auth.email')} type="email" value={email} onChange={setEmail} />
          {err && <ErrorMsg msg={t(err)} />}
          <button type="submit" disabled={busy} className="btn-brass w-full disabled:opacity-60">
            {busy ? '…' : t('auth.forgotSend')}
          </button>
        </form>
      )}
      <div className="mt-6 text-center">
        <Link to="/vhod" className="font-mono text-xs tracking-[0.18em] uppercase text-ash hover:text-brass-hi">
          ← {t('auth.loginBtn')}
        </Link>
      </div>
    </AuthShell>
  )
}

// ─── Reset password ────────────────────────────────────────────────────
export function ResetPassword() {
  const t = useT()
  const nav = useNavigate()
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [err, setErr] = useState<MessageKey | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwd.length < 8) { setErr('common.passwordShort'); return }
    if (pwd !== pwd2) { setErr('common.passwordMismatch'); return }
    setErr(null)
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pwd })
    setBusy(false)
    if (error) { setErr(authErrorKey(error.message)); return }
    setDone(true)
    setTimeout(() => nav('/vhod', { replace: true }), 1800)
  }

  return (
    <AuthShell title={t('auth.resetTitle')}>
      <p className="text-center font-display italic text-cream/70 mb-5 text-sm">{t('auth.resetBody')}</p>
      <form onSubmit={submit} noValidate className="space-y-4">
        <PasswordField label={t('auth.password')} value={pwd} onChange={setPwd} show={showPwd} onToggle={() => setShowPwd((s) => !s)} autoComplete="new-password" hint={t('auth.passwordHint')} />
        <PasswordField label={t('auth.passwordConfirm')} value={pwd2} onChange={setPwd2} show={showPwd} onToggle={() => setShowPwd((s) => !s)} autoComplete="new-password" />
        {err && <ErrorMsg msg={t(err)} />}
        {done && <div className="text-brass-hi text-center font-display italic text-sm">{t('auth.resetSuccess')}</div>}
        <button type="submit" disabled={busy || done} className="btn-brass w-full disabled:opacity-60">
          {busy ? '…' : t('auth.resetSubmit')}
        </button>
      </form>
    </AuthShell>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────
function Field({
  label, value, onChange, type = 'text', hint, autoComplete,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  hint?: string
  autoComplete?: string
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="input-salon w-full mt-1.5"
      />
      {hint && <span className="block mt-1 text-[11px] font-display italic text-ash">{hint}</span>}
    </label>
  )
}

function PasswordField({
  label, value, onChange, show, onToggle, autoComplete, hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggle: () => void
  autoComplete?: string
  hint?: string
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <div className="relative mt-1.5">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="input-salon w-full pr-10"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? 'Скрий паролата' : 'Покажи паролата'}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ash hover:text-cream transition"
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {hint && <span className="block mt-1 text-[11px] font-display italic text-ash">{hint}</span>}
    </label>
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 bg-ember/10 border border-ember/30 rounded px-3 py-2"
    >
      <span className="text-ember-hi mt-0.5 shrink-0">✕</span>
      <span className="text-ember-hi font-display italic text-sm">{msg}</span>
    </motion.div>
  )
}

function OAuthDivider() {
  const t = useT()
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 h-px bg-brass/20" />
      <span className="font-display text-ash text-xs italic">{t('auth.or')}</span>
      <div className="flex-1 h-px bg-brass/20" />
    </div>
  )
}

function OAuthButtons({ onGoogle, onFacebook }: { onGoogle: () => void; onFacebook: () => void }) {
  const t = useT()
  return (
    <div className="grid grid-cols-1 gap-2">
      <button type="button" onClick={onGoogle} className="btn-ghost w-full flex items-center justify-center gap-2.5">
        <GoogleIcon />
        {t('auth.continueGoogle')}
      </button>
      <button type="button" onClick={onFacebook} className="btn-ghost w-full flex items-center justify-center gap-2.5">
        <FacebookIcon />
        {t('auth.continueFacebook')}
      </button>
    </div>
  )
}

// ─── SVG Icons ─────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="#1877F2">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073Z"/>
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}
