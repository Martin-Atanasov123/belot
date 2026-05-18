import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PublicNav } from '../components/PublicNav.js'
import { Monogram } from '../components/Ornaments.js'
import { useT } from '../i18n/index.js'

// Shared shell — same atmospheric framing used by Login/Signup/Forgot.
// No corner ornaments INSIDE the form (spec §5: "form is Tier B logic, needs full attention").
function AuthShell({
  title,
  children,
  footer,
}: {
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
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
          {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
        </motion.div>
      </main>
    </div>
  )
}

// ─── Login ─────────────────────────────────────────────────────────────
export function Login() {
  const t = useT()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !pwd.trim()) {
      setErr(t('common.required'))
      return
    }
    // TODO: wire to Supabase auth. For now, no backend → notify and bail.
    setErr(t('common.coming'))
  }

  return (
    <AuthShell title={t('auth.loginTitle')}>
      <form onSubmit={submit} className="space-y-4">
        <Field
          label={t('auth.email')}
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <Field
          label={t('auth.password')}
          type="password"
          value={pwd}
          onChange={setPwd}
          autoComplete="current-password"
        />
        <div className="text-right">
          <Link
            to="/forgot-password"
            className="font-mono text-[11px] tracking-[0.18em] uppercase text-ash hover:text-brass-hi"
          >
            {t('auth.forgot')}
          </Link>
        </div>
        <button type="submit" className="btn-brass w-full">
          {t('auth.loginBtn')}
        </button>
        {err && <div className="text-ember-hi text-center font-display italic text-sm">{err}</div>}
        <OAuthDivider />
        <OAuthButtons onClick={() => setErr(t('common.coming'))} />
        <div className="text-center text-sm font-display italic text-ash mt-3">
          {t('auth.noAccount')}{' '}
          <Link to="/registracia" className="text-brass-hi hover:underline">
            {t('auth.signupBtn')}
          </Link>
        </div>
      </form>
    </AuthShell>
  )
}

// ─── Signup ────────────────────────────────────────────────────────────
export function Signup() {
  const t = useT()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [accept, setAccept] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !email.trim() || !pwd) {
      setErr(t('common.required'))
      return
    }
    if (pwd.length < 8) {
      setErr(t('common.passwordShort'))
      return
    }
    if (pwd !== pwd2) {
      setErr(t('common.passwordMismatch'))
      return
    }
    if (!accept) {
      setErr(t('auth.acceptTerms'))
      return
    }
    setErr(t('common.coming'))
  }

  return (
    <AuthShell title={t('auth.signupTitle')}>
      <form onSubmit={submit} className="space-y-4">
        <Field
          label={t('auth.username')}
          value={username}
          onChange={setUsername}
          hint={t('auth.usernameHint')}
          autoComplete="username"
        />
        <Field label={t('auth.email')} type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field
          label={t('auth.password')}
          type="password"
          value={pwd}
          onChange={setPwd}
          autoComplete="new-password"
        />
        <Field
          label={t('auth.passwordConfirm')}
          type="password"
          value={pwd2}
          onChange={setPwd2}
          autoComplete="new-password"
        />
        <label className="flex items-start gap-2 text-xs text-cream/80 cursor-pointer">
          <input
            type="checkbox"
            checked={accept}
            onChange={(e) => setAccept(e.target.checked)}
            className="mt-0.5 accent-brass"
          />
          <span className="font-display italic">{t('auth.acceptTerms')}</span>
        </label>
        <button type="submit" className="btn-brass w-full">
          {t('auth.signupBtn')}
        </button>
        {err && <div className="text-ember-hi text-center font-display italic text-sm">{err}</div>}
        <OAuthDivider />
        <OAuthButtons onClick={() => setErr(t('common.coming'))} />
        <div className="text-center text-sm font-display italic text-ash mt-3">
          {t('auth.haveAccount')}{' '}
          <Link to="/vhod" className="text-brass-hi hover:underline">
            {t('auth.loginBtn')}
          </Link>
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
  return (
    <AuthShell title={t('auth.forgotTitle')}>
      <p className="text-center font-display italic text-cream/70 mb-5 text-sm">
        {t('auth.forgotBody')}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setSent(true)
        }}
        className="space-y-4"
      >
        <Field label={t('auth.email')} type="email" value={email} onChange={setEmail} />
        <button type="submit" className="btn-brass w-full">
          {t('auth.forgotSend')}
        </button>
        {sent && (
          <div className="text-brass-hi text-center font-display italic text-sm">
            {t('common.coming')}
          </div>
        )}
      </form>
      <div className="mt-6 text-center">
        <Link to="/vhod" className="font-mono text-xs tracking-[0.18em] uppercase text-ash hover:text-brass-hi">
          ← {t('auth.loginBtn')}
        </Link>
      </div>
    </AuthShell>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────
function Field({
  label,
  value,
  onChange,
  type = 'text',
  hint,
  autoComplete,
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

function OAuthButtons({ onClick }: { onClick: () => void }) {
  const t = useT()
  return (
    <div className="grid grid-cols-1 gap-2">
      <button type="button" onClick={onClick} className="btn-ghost w-full">
        <span className="mr-2">G</span> {t('auth.continueGoogle')}
      </button>
      <button type="button" onClick={onClick} className="btn-ghost w-full">
        <span className="mr-2">f</span> {t('auth.continueFacebook')}
      </button>
    </div>
  )
}
