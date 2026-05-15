import { useGame } from '../store/game.js'

export function Lobby() {
  const room = useGame((s) => s.room)!
  const amHost = useGame((s) => s.amHost)
  const start = useGame((s) => s.start)
  const url = window.location.href.split('?')[0] ?? window.location.href
  const allFilled = room.seats.every((s) => s.nickname !== null)

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-emerald-800/70 rounded-xl p-6 shadow-2xl space-y-4 border border-emerald-700">
        <h1 className="text-2xl font-bold text-center">Стая {room.code}</h1>
        <div className="bg-emerald-950 rounded p-3 flex items-center gap-2">
          <code className="flex-1 text-emerald-200 text-sm truncate">{url}</code>
          <button
            onClick={() => navigator.clipboard.writeText(url)}
            className="rounded bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold px-3 py-1 text-sm"
          >
            Копирай
          </button>
        </div>
        <p className="text-emerald-200 text-sm">Изпрати линка на още 3-ма приятели за да започнете.</p>

        <ul className="divide-y divide-emerald-700 border border-emerald-700 rounded">
          {room.seats.map((s) => (
            <li key={s.seat} className="flex items-center gap-3 px-3 py-2">
              <span className="w-16 text-emerald-300 text-sm">Място {s.seat + 1}</span>
              <span className="flex-1">
                {s.nickname ?? <em className="text-emerald-400">свободно</em>}
              </span>
              {s.nickname && (
                <span
                  className={`text-xs ${s.connected ? 'text-emerald-300' : 'text-amber-300'}`}
                >
                  {s.connected ? '● онлайн' : '○ офлайн'}
                </span>
              )}
            </li>
          ))}
        </ul>

        {amHost ? (
          <button
            onClick={() => void start()}
            disabled={!allFilled}
            className="w-full rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-900 font-semibold py-2"
          >
            {allFilled ? 'Започни играта' : 'Изчакване на играчи…'}
          </button>
        ) : (
          <p className="text-center text-emerald-200 text-sm">Изчакване домакинът да започне играта…</p>
        )}
      </div>
    </div>
  )
}
