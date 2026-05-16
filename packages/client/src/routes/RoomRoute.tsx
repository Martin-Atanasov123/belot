import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useGame } from '../store/game.js'
import { getNickname, getPlayerIdFor, setNickname } from '../lib/identity.js'
import { useT } from '../i18n/index.js'
import { Lobby } from '../components/Lobby.js'
import { Table } from '../components/Table.js'
import { JoinForm } from '../components/JoinForm.js'

export function RoomRoute() {
  const t = useT()
  const { code } = useParams<{ code: string }>()
  const [search] = useSearchParams()
  const isHost = search.get('host') === '1'
  const join = useGame((s) => s.join)
  const room = useGame((s) => s.room)
  const view = useGame((s) => s.view)
  const joinError = useGame((s) => s.joinError)

  // If a saved nickname exists we auto-join immediately. Otherwise we show the
  // JoinForm so the visitor (e.g. someone who opened the invite link) can pick a
  // nickname before being seated.
  const initialNick = getNickname()
  const [nick, setNick] = useState<string | null>(isHost && initialNick ? initialNick : (initialNick || null))
  const [chosen, setChosen] = useState(isHost || Boolean(initialNick))

  useEffect(() => {
    if (!code || !chosen) return
    const n = (nick && nick.trim()) || initialNick || 'Guest'
    void join({ code, playerId: getPlayerIdFor(n), nickname: n, isHost })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, chosen, nick, isHost])

  if (!code) return null

  if (!chosen) {
    return (
      <JoinForm
        code={code.toUpperCase()}
        initialNick={initialNick}
        onSubmit={(n) => {
          setNickname(n)
          setNick(n)
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
