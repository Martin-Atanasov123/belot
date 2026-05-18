import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Monogram } from './Ornaments.js'
import { LanguageToggle } from './LanguageToggle.js'
import { useT } from '../i18n/index.js'
import { useAuth } from '../lib/auth.js'

// Public Navigation — per design spec §Navigation Structure (Public Nav).
// Transparent over the hero on the landing page; solid `#0e251c` with backdrop-blur
// once the user scrolls past 60px. Mobile: hamburger → full-screen dark overlay menu.
//
// IMPORTANT: brass appears on nav items ONLY on hover and for the active route
// (2px underline). No passive brass borders/labels — per the brass-usage checklist.
export function PublicNav({ overHero = false }: { overHero?: boolean }) {
  const t = useT()
  const loc = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close mobile menu on route change.
  useEffect(() => {
    setMobileOpen(false)
  }, [loc.pathname])

  const transparent = overHero && !scrolled

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-200 ${
          transparent
            ? 'bg-transparent border-transparent'
            : 'bg-racing/80 backdrop-blur-md border-b border-brass/10'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3">
          {/* Logo / monogram */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <Monogram size={32} />
            <span className="hidden sm:inline font-display italic text-cream/90 text-base group-hover:text-brass-hi transition">
              Le Salon de Belot
            </span>
          </Link>

          {/* Center nav — desktop only */}
          <nav className="hidden md:flex items-center gap-1">
            <NavItem to="/rules" label={t('nav.rules')} />
            <NavItem to="/klasacia" label={t('nav.leaderboard')} />
            <NavItem to="/premium" label={t('nav.premium')} />
          </nav>

          {/* Right side: auth + lang */}
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageToggle />
            <AuthSlot />

            {/* Mobile hamburger */}
            <button
              type="button"
              aria-label="Menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((s) => !s)}
              className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded text-cream hover:text-brass-hi transition"
            >
              <Hamburger open={mobileOpen} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile overlay menu — full-screen, dark, monogram at top */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-void/95 backdrop-blur-lg md:hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-4 h-14">
              <Link to="/" className="flex items-center gap-2">
                <Monogram size={28} />
                <span className="font-display italic text-cream/90 text-sm">Le Salon</span>
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="w-10 h-10 inline-flex items-center justify-center text-cream hover:text-brass-hi"
              >
                <Hamburger open />
              </button>
            </div>
            <nav className="flex-1 flex flex-col items-center justify-center gap-5 font-display text-2xl">
              <MobileLink to="/rules" label={t('nav.rules')} />
              <MobileLink to="/klasacia" label={t('nav.leaderboard')} />
              <MobileLink to="/premium" label={t('nav.premium')} />
              <div className="w-24 h-px bg-brass/30 my-4" />
              <MobileAuth />
            </nav>
            <div className="pb-6 text-center font-mono text-[10px] tracking-widest text-ash/60 uppercase">
              {t('common.sofia')}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// Single nav link with active-state brass underline (no background highlight, per spec).
function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'relative px-3 py-2 font-mono text-[11px] tracking-[0.22em] uppercase transition',
          isActive ? 'text-brass-hi' : 'text-ash hover:text-cream',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          {label}
          {isActive && (
            <motion.span
              layoutId="nav-active-underline"
              className="absolute left-3 right-3 -bottom-px h-[2px] bg-brass"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </>
      )}
    </NavLink>
  )
}

function MobileLink({ to, label, muted }: { to: string; label: string; muted?: boolean }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'font-display tracking-wide transition',
          muted ? 'text-ash text-lg' : 'text-cream text-2xl',
          isActive ? 'text-brass-hi' : 'hover:text-brass-hi',
        ].join(' ')
      }
    >
      {label}
    </NavLink>
  )
}

// Desktop auth slot — either Login/Signup links (signed out) or
// username + dropdown to logout (signed in).
function AuthSlot() {
  const t = useT()
  const status = useAuth((s) => s.status)
  const session = useAuth((s) => s.session)
  const profile = useAuth((s) => s.profile)
  const user = useAuth((s) => s.user)
  const signOut = useAuth((s) => s.signOut)
  const [open, setOpen] = useState(false)

  if (status === 'loading') {
    return <div className="hidden sm:block w-24 h-8" aria-hidden />
  }

  if (!session) {
    return (
      <>
        <Link
          to="/vhod"
          className="hidden sm:inline-flex font-mono text-xs tracking-[0.18em] uppercase text-ash hover:text-brass-hi transition px-2 py-1.5"
        >
          {t('nav.login')}
        </Link>
        <Link
          to="/registracia"
          className="hidden sm:inline-flex btn-brass text-[10px] !min-h-0 !py-2 !px-4"
        >
          {t('nav.signup')}
        </Link>
      </>
    )
  }

  const name = profile?.username ?? user?.email?.split('@')[0] ?? '—'
  const initial = name.trim()[0]?.toUpperCase() ?? '?'

  return (
    <div className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
        className="flex items-center gap-2 px-2 py-1.5 rounded font-mono text-xs tracking-[0.18em] uppercase text-cream/80 hover:text-brass-hi transition"
      >
        <span
          aria-hidden
          className="w-7 h-7 rounded-full border border-brass/40 bg-racing/60 flex items-center justify-center font-display italic text-cream"
        >
          {initial}
        </span>
        <span className="max-w-[100px] truncate">{name}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-44 plate p-2 z-50"
          >
            <Link
              to="/tablo"
              onClick={() => setOpen(false)}
              className="block w-full text-left px-3 py-2 font-mono text-[11px] tracking-[0.18em] uppercase text-cream/80 hover:text-brass-hi transition"
            >
              {t('nav.dashboard')}
            </Link>
            <Link
              to={`/profil/${encodeURIComponent(name)}`}
              onClick={() => setOpen(false)}
              className="block w-full text-left px-3 py-2 font-mono text-[11px] tracking-[0.18em] uppercase text-cream/80 hover:text-brass-hi transition"
            >
              {t('nav.profile')}
            </Link>
            <Link
              to="/nastroyki"
              onClick={() => setOpen(false)}
              className="block w-full text-left px-3 py-2 font-mono text-[11px] tracking-[0.18em] uppercase text-cream/80 hover:text-brass-hi transition"
            >
              {t('nav.settings')}
            </Link>
            <div className="h-px bg-brass/15 my-1" />
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                void signOut()
              }}
              className="block w-full text-left px-3 py-2 font-mono text-[11px] tracking-[0.18em] uppercase text-ember-hi/90 hover:text-ember-hi transition"
            >
              {t('auth.logout')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Mobile auth chunk for the full-screen overlay menu.
function MobileAuth() {
  const t = useT()
  const session = useAuth((s) => s.session)
  const profile = useAuth((s) => s.profile)
  const user = useAuth((s) => s.user)
  const signOut = useAuth((s) => s.signOut)

  if (!session) {
    return (
      <>
        <MobileLink to="/vhod" label={t('nav.login')} muted />
        <Link to="/registracia" className="btn-brass mt-2">
          {t('nav.signup')}
        </Link>
      </>
    )
  }
  const name = profile?.username ?? user?.email?.split('@')[0] ?? '—'
  return (
    <>
      <div className="font-display italic text-cream text-xl">
        {t('auth.welcome')}, {name}
      </div>
      <MobileLink to="/tablo" label={t('nav.dashboard')} muted />
      <MobileLink to={`/profil/${encodeURIComponent(name)}`} label={t('nav.profile')} muted />
      <MobileLink to="/nastroyki" label={t('nav.settings')} muted />
      <button
        type="button"
        onClick={() => void signOut()}
        className="font-display text-lg text-ember-hi/90 hover:text-ember-hi tracking-wide mt-2"
      >
        {t('auth.logout')}
      </button>
    </>
  )
}

function Hamburger({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <motion.line
        x1="3" x2="17"
        animate={open ? { y1: 10, y2: 10, rotate: 45 } : { y1: 5, y2: 5, rotate: 0 }}
        style={{ transformOrigin: '10px 10px' }}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <motion.line
        x1="3" x2="17" y1="10" y2="10"
        animate={open ? { opacity: 0 } : { opacity: 1 }}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <motion.line
        x1="3" x2="17"
        animate={open ? { y1: 10, y2: 10, rotate: -45 } : { y1: 15, y2: 15, rotate: 0 }}
        style={{ transformOrigin: '10px 10px' }}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}
