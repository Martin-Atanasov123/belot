import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useGame } from '../store/game.js'
import { getNickname, getPlayerIdFor } from '../lib/identity.js'
import { Lobby } from '../components/Lobby.js'
import { Table } from '../components/Table.js'

export function RoomRoute() {
  const { code } = useParams<{ code: string }>()
  const [search] = useSearchParams()
  const isHost = search.get('host') === '1'
  const join = useGame((s) => s.join)
  const room = useGame((s) => s.room)
  const view = useGame((s) => s.view)
  const joinError = useGame((s) => s.joinError)

  useEffect(() => {
    if (!code) return
    const nick = getNickname() || 'Гост'
    void join({ code, playerId: getPlayerIdFor(nick), nickname: nick, isHost })
  }, [code, isHost, join])

  if (joinError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-900/70 p-4 rounded">Грешка: {joinError}</div>
      </div>
    )
  }
  if (!room) return <Center>Свързване…</Center>
  if (!view) return <Lobby />
  return <Table />
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center text-emerald-200">{children}</div>
}
