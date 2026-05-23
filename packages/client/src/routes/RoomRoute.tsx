import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useGame } from '../store/game.js'
import { getNickname, getPlayerIdFor, setNickname } from '../lib/identity.js'
import { useAuth } from '../lib/auth.js'
import { useT } from '../i18n/index.js'
import { useTurnNotifier } from '../lib/notify.js'
import { Lobby } from '../components/Lobby.js'
import { Table } from '../components/Table.js'
import { JoinForm } from '../components/JoinForm.js'
import { ErrorScreen } from '../components/ErrorScreen.js'

type Mode = 'play' | 'spectate'

// Remount the room view whenever the room code changes. Without a key, React
// Router reuses this component across /r/A → /r/B navigations, so per-room UI
// state (chosen / mode / nick / spectate-fallback) leaks between rooms — e.g. a
// "spectate" choice in one room sticks and you can only watch every room after.
// Keying by code forces a fresh mount so all that state re-derives from the URL.
export function RoomRoute() {
  const { code } = useParams<{ code: string }>()
  return <RoomRouteInner key={code ?? 'none'} />
}

function RoomRouteInner() {
  const t = useT()
  const { code } = useParams<{ code: string }>()
  const [search] = useSearchParams()
  const isHost = search.get('host') === '1'
  const urlWantsSpectate = search.get('spectate') === '1'
  const join = useGame((s) => s.join)
  const spectate = useGame((s) => s.spectate)
  const clearJoinError = useGame((s) => s.clearJoinError)
  const room = useGame((s) => s.room)
  const view = useGame((s) => s.view)
  const amSpectator = useGame((s) => s.amSpectator)
  const joinError = useGame((s) => s.joinError)

  const profile = useAuth((s) => s.profile)
  const authUser = useAuth((s) => s.user)
  // Signed-in users: use their profile username + stable auth uid as playerId.
  // Guests: fall back to the localStorage-cached nickname + uuid.
  const authedNick = profile?.username ?? authUser?.email?.split('@')[0] ?? null
  const initialNick = authedNick ?? getNickname()
  // Host and players with a saved nickname or auth profile auto-enter; everyone
  // else picks a nickname (and play/spectate) on the JoinForm first.
  const autoEnter = isHost || (Boolean(initialNick) && !urlWantsSpectate)
  const [chosen, setChosen] = useState(autoEnter)
  const [mode, setMode] = useState<Mode>(urlWantsSpectate ? 'spectate' : 'play')
  const [nick, setNick] = useState<string | null>(autoEnter ? initialNick || null : null)

  const [fellBackToSpectate, setFellBackToSpectate] = useState(false)
  // Bumped by the "Try again" button on the error screen to re-fire the effect.
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    if (!code || !chosen) return
    const n = (nick && nick.trim()) || initialNick || 'Guest'
    // Authed user → stable playerId from auth uid. Guests → localStorage uuid.
    const playerId = authUser?.id ?? getPlayerIdFor(n)
    const args = { code, playerId, nickname: n }
    const enter = async () => {
      if (mode === 'spectate') {
        await spectate(args)
        return
      }
      const r = await join({ ...args, isHost })
      // Auto-fallback: if the room is full of humans, become a spectator
      // instead of dead-ending on an error screen.
      if (!r.ok && /room\s*full|full/i.test(r.error ?? '')) {
        setFellBackToSpectate(true)
        const sp = await spectate(args)
        if (!sp.ok) {
          // Spectate also failed — clear the suppression so the user sees the error.
          setFellBackToSpectate(false)
        }
      }
    }
    void enter()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, chosen, mode, nick, isHost, retryNonce])

  // Browser notification + sound when it becomes your turn (opt-in in Settings).
  useTurnNotifier(view, { title: t('notif.turnTitle'), body: t('notif.turnBody') })

  if (!code) return null

  if (!chosen) {
    return (
      <JoinForm
        code={code.toUpperCase()}
        initialNick={initialNick}
        onSubmit={(n) => {
          setNickname(n)
          setNick(n)
          setMode('play')
          setChosen(true)
        }}
        onSpectate={(n) => {
          setNickname(n)
          setNick(n)
          setMode('spectate')
          setChosen(true)
        }}
      />
    )
  }

  // While the auto-fallback is in flight, treat the transient "room full" error
  // as a connecting state rather than a hard error screen.
  if (joinError && !fellBackToSpectate) {
    return (
      <ErrorScreen
        errorCode={joinError}
        onRetry={() => {
          clearJoinError()
          setRetryNonce((n) => n + 1)
        }}
      />
    )
  }

  if (!room) return <Center>{t('room.connecting')}</Center>
  // Spectators jump straight to the table once a game is in progress; while the
  // game hasn't started they sit on the Lobby too, just without a seat.
  const fullSpectateBanner = fellBackToSpectate && amSpectator ? (
    <FellBackBanner text={t('room.fullSpectating')} />
  ) : null
  if (amSpectator) return (
    <>
      {fullSpectateBanner}
      {view ? <Table /> : <Lobby />}
    </>
  )
  if (!view) return <Lobby />
  return <Table />
}

// Small floating banner shown briefly when the user fell back to spectating
// because the room was full of humans.
function FellBackBanner({ text }: { text: string }) {
  const [shown, setShown] = useState(true)
  useEffect(() => {
    const id = setTimeout(() => setShown(false), 4500)
    return () => clearTimeout(id)
  }, [])
  if (!shown) return null
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 plate px-4 py-2 border border-brass-hi/50 font-display italic text-cream/90 text-sm shadow-lg">
      {text}
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink">
      <div className="font-display italic text-cream/70 text-lg">{children}</div>
    </div>
  )
}
