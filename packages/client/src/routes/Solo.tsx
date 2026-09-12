import { useEffect } from 'react'
import { useGame } from '../store/game.js'
import { useAuth } from '../lib/auth.js'
import { getNickname } from '../lib/identity.js'
import { Table } from '../components/Table.js'
import { usePrivatePage } from '../lib/seo.js'
import { useT } from '../i18n/index.js'

// Offline solo-vs-bots route. The engine runs entirely in the browser — no
// socket, no cold-start wait. This is what makes the site playable in <3s
// for a fresh visitor (see CLAUDE.md § 0.5.5).
//
// When the user later wants a multiplayer game, exitLocalGame() clears the
// local state and standard flows take over.
export function Solo() {
  const t = useT()
  usePrivatePage(t('solo.title'))

  const mode = useGame((s) => s.mode)
  const view = useGame((s) => s.view)
  const room = useGame((s) => s.room)
  const startLocalGame = useGame((s) => s.startLocalGame)
  const exitLocalGame = useGame((s) => s.exitLocalGame)

  const profile = useAuth((s) => s.profile)
  const user = useAuth((s) => s.user)
  const nick = profile?.username ?? user?.email?.split('@')[0] ?? getNickname() ?? 'Ти'

  // Kick off a local game on mount if we're not already in one. StrictMode
  // double-invoke is safe — a fresh startLocalGame just re-seeds the match.
  useEffect(() => {
    if (mode !== 'local' || !view) {
      startLocalGame({ nickname: nick })
    }
    // Cleanup: exit local mode when navigating away.
    return () => {
      // We only clear if we're still in local mode when unmounting.
      // exitLocalGame is idempotent when mode is already 'remote'.
      if (useGame.getState().mode === 'local') useGame.getState().exitLocalGame()
    }
    // Intentionally omit deps — this must fire exactly on mount/unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Until startLocalGame finishes seeding, show nothing (single frame).
  if (!view || !room) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <div className="font-display italic text-brass-hi text-sm">
          {t('solo.dealing')}
        </div>
      </div>
    )
  }

  // Table renders straight from the store — same component multiplayer uses.
  // The store's send() branches to the local reducer when mode === 'local'.
  return <Table />
}
