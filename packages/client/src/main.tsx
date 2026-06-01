import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Landing } from './routes/Landing.js'
import { RoomRoute } from './routes/RoomRoute.js'
import { Rules } from './routes/Rules.js'
import { Leaderboard } from './routes/Leaderboard.js'
import { Premium } from './routes/Premium.js'
import { Login, Signup, ForgotPassword, ResetPassword } from './routes/AuthPages.js'
import { bootstrapAuth } from './lib/auth.js'
import { Tablo } from './routes/Tablo.js'
import { Settings } from './routes/Settings.js'
import { Profile } from './routes/Profile.js'
import { Tournaments } from './routes/Tournaments.js'
import { TournamentDetail } from './routes/TournamentDetail.js'
import { ComingSoon } from './routes/ComingSoon.js'
import { ErrorScreen, NotFoundScreen } from './components/ErrorScreen.js'
import { ConnectionBanner } from './components/ConnectionBanner.js'
import { useI18n } from './i18n/index.js'
import './index.css'

// React error boundary — catches render-time crashes anywhere below it and
// shows the salon-themed error screen instead of a white page.
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  override state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('AppErrorBoundary caught:', error, info)
  }
  override render() {
    if (this.state.error) {
      return <ErrorScreen errorCode={this.state.error.message} />
    }
    return this.props.children
  }
}

// Initialise <html lang="…"> on first paint so screen readers pick the right voice.
document.documentElement.lang = useI18n.getState().locale

// Boot the auth store — pulls the existing Supabase session (if any) and
// subscribes to future sign-in / sign-out events.
bootstrapAuth()

// Register the PWA service worker (production only — dev uses Vite's HMR shell).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* ignore — the app still works fully without it */
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <ConnectionBanner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/r/:code" element={<RoomRoute />} />
          <Route path="/rules" element={<Rules />} />
          {/* Bulgarian-localised aliases per spec (URL slugs in Bulgarian/transliterated). */}
          <Route path="/pravila" element={<Rules />} />
          <Route path="/klasacia" element={<Leaderboard />} />
          <Route path="/premium" element={<Premium />} />
          <Route path="/vhod" element={<Login />} />
          <Route path="/registracia" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* Hub / profile / settings / tournaments — all visual-complete; DB-wired in later phases. */}
          <Route path="/tablo" element={<Tablo />} />
          <Route path="/profil/:username" element={<Profile />} />
          <Route path="/nastroyki" element={<Settings />} />
          <Route path="/turniri" element={<Tournaments />} />
          <Route path="/turniri/:id" element={<TournamentDetail />} />
          {/* Single remaining stub — /staya/nova (room-creation form) is part of Phase B. */}
          <Route path="/staya/nova" element={<ComingSoon titleKey="tablo.newRoom" />} />
          {/* Catch-all 404 — any unknown URL ends up on the salon error page. */}
          <Route path="*" element={<NotFoundScreen />} />
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>,
)
