import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Landing } from './routes/Landing.js'
import { RoomRoute } from './routes/RoomRoute.js'
import { Rules } from './routes/Rules.js'
import { ErrorScreen, NotFoundScreen } from './components/ErrorScreen.js'
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
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/r/:code" element={<RoomRoute />} />
          <Route path="/rules" element={<Rules />} />
          {/* Catch-all 404 — any unknown URL ends up on the salon error page. */}
          <Route path="*" element={<NotFoundScreen />} />
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>,
)
