import { useEffect, useRef } from 'react'
import type { PlayerView } from '@belot/shared'

// Browser turn notifications + optional sound cue. No backend — everything is
// the Web Notifications API + a tiny WebAudio beep, gated by localStorage prefs.

export const NOTIF_KEYS = {
  turn: 'belot.notif.turn',   // browser notification when it's your turn
  sound: 'belot.notif.sound', // sound cue when it's your turn
} as const

export function readNotifPref(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'on'
  } catch {
    return false
  }
}

export function writeNotifPref(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? 'on' : 'off')
  } catch {
    /* localStorage disabled — silent */
  }
}

// Request browser-notification permission. Returns the resulting permission, or
// 'unsupported' if the API isn't available (e.g. some mobile browsers).
export async function enableTurnAlerts(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported'
  let perm = Notification.permission
  if (perm === 'default') perm = await Notification.requestPermission()
  return perm
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

// Short, gentle WebAudio chime — no asset to bundle.
function playBeep(): void {
  try {
    const Ctx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
    osc.onended = () => void ctx.close()
  } catch {
    /* audio blocked — silent */
  }
}

// Fires a notification + sound on the rising edge of "it's your turn". The
// browser notification only shows when the tab is in the background (you don't
// need a popup while you're looking at the table); the sound plays either way.
export function useTurnNotifier(
  view: PlayerView | null,
  labels: { title: string; body: string },
): void {
  const wasMyTurn = useRef(false)
  useEffect(() => {
    const isMyTurn =
      !!view &&
      (view.phase === 'BIDDING' || view.phase === 'PLAYING') &&
      view.turn === view.you
    if (isMyTurn && !wasMyTurn.current) {
      if (readNotifPref(NOTIF_KEYS.sound)) playBeep()
      if (
        readNotifPref(NOTIF_KEYS.turn) &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        typeof document !== 'undefined' &&
        document.hidden
      ) {
        try {
          const n = new Notification(labels.title, { body: labels.body, tag: 'belot-turn' })
          n.onclick = () => {
            window.focus()
            n.close()
          }
        } catch {
          /* notification blocked — silent */
        }
      }
    }
    wasMyTurn.current = isMyTurn
  }, [view, labels.title, labels.body])
}
