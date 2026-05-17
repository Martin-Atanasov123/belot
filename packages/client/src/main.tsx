import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Landing } from './routes/Landing.js'
import { RoomRoute } from './routes/RoomRoute.js'
import { Rules } from './routes/Rules.js'
import { useI18n } from './i18n/index.js'
import './index.css'

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
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/r/:code" element={<RoomRoute />} />
        <Route path="/rules" element={<Rules />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
