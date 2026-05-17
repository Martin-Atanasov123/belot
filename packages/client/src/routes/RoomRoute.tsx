import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useGame } from '../store/game.js'
import { getNickname, getPlayerIdFor, setNickname } from '../lib/identity.js'
import { useT } from '../i18n/index.js'
import { Lobby } from '../components/Lobby.js'
import { Table } from '../components/Table.js'
import { JoinForm } from '../components/JoinForm.js'

type Mode = 'play' | 'spectate'

export function RoomRoute() {
  const t = useT()
  const { code } = useParams<{ code: string }>()
  const [search] = useSearchParams()
  const isHost = search.get('host') === '1'
  const urlWantsSpectate = search.get('spectate') === '1'
  const join = useGame((s) => s.join)
  const spectate = useGame((s) => s.spectate)
  const room = useGame((s) => s.room)
  const view = useGame((s) => s.view)
  const amSpectator = useGame((s) => s.amSpectator)
  const joinError = useGame((s) => s.joinError)

  const initialNick = getNickname()
  // Host and players with a saved nickname auto-enter; everyone else picks a
  // nickname (and play/spectate) on the JoinForm first.
  const autoEnter = isHost || (Boolean(initialNick) && !urlWantsSpectate)
  const [chosen, setChosen] = useState(autoEnter)
  const [mode, setMode] = useState<Mode>(urlWantsSpectate ? 'spectate' : 'play')
  const [nick, setNick] = useState<string | null>(autoEnter ? initialNick || null : null)

  useEffect(() => {
    if (!code || !chosen) return
    const n = (nick && nick.trim()) || initialNick || 'Guest'
    const args = { code, playerId: getPlayerIdFor(n), nickname: n }
    if (mode === 'spectate') void spectate(args)
    else void join({ ...args, isHost })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, chosen, mode, nick, isHost])

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

  if (joinError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-ink">
        <div className="plate px-6 py-5 text-center max-w-sm">
          <div className="eyebrow text-ember-hi">{t('common.error')}</div>
          <div className="font-display italic text-cream/80 mt-2">{joinError}</div>
        </div>
      </div>
    )
  }

  if (!room) return <Center>{t('room.connecting')}</Center>
  // Spectators jump straight to the table once a game is in progress; while the
  // game hasn't started they sit on the Lobby too, just without a seat.
  if (amSpectator) return view ? <Table /> : <Lobby />
  if (!view) return <Lobby />
  return <Table />
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink">
      <div className="font-display italic text-cream/70 text-lg">{children}</div>
    </div>
  )
}
