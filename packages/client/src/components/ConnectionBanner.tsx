import { useEffect, useState } from 'react'
import { useGame } from '../store/game.js'
import { useT } from '../i18n/index.js'

// Tiny fixed-top banner that surfaces a slow Socket.IO connect. Renders only
// when we've kicked off a connection (socket exists) but it hasn't reached
// 'connected' yet. After ~5 s of waiting we flip the copy to a "the server is
// waking up" hint — Render's free tier sleeps after idle and a cold start
// regularly takes 20–30 seconds, which otherwise feels like the site is broken.
export function ConnectionBanner() {
  const t = useT()
  const socket = useGame((s) => s.socket)
  const connected = useGame((s) => s.connected)
  const [wakeHint, setWakeHint] = useState(false)

  useEffect(() => {
    if (!socket || connected) {
      setWakeHint(false)
      return
    }
    const id = window.setTimeout(() => setWakeHint(true), 5000)
    return () => window.clearTimeout(id)
  }, [socket, connected])

  if (!socket || connected) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 bg-felt-hi/95 backdrop-blur-sm border-b border-brass/30 text-cream/90 font-mono text-[11px] sm:text-xs tracking-[0.14em] py-1.5 px-3"
    >
      <span
        aria-hidden
        className="inline-block w-3 h-3 rounded-full border-2 border-brass/40 border-t-brass-hi animate-spin"
      />
      <span>{wakeHint ? t('conn.wakingUp') : t('conn.connecting')}</span>
    </div>
  )
}
