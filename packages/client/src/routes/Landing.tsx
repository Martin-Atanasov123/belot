import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRoom } from '../lib/api.js'
import { getNickname, getPlayerIdFor, setNickname } from '../lib/identity.js'

export function Landing() {
  const nav = useNavigate()
  const [nick, setNick] = useState(getNickname())
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const persistNick = () => {
    const n = nick.trim()
    if (!n) {
      setError('Въведи прякор')
      return false
    }
    setNickname(n)
    return true
  }

  const onCreate = async () => {
    if (!persistNick()) return
    setBusy(true); setError(null)
    try {
      const { code } = await createRoom(getPlayerIdFor(nick.trim()))
      nav(`/r/${code}?host=1`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const onJoin = () => {
    if (!persistNick()) return
    const c = joinCode.trim().toUpperCase()
    if (!c) { setError('Въведи код на стая'); return }
    nav(`/r/${c}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-emerald-800/70 backdrop-blur rounded-xl p-6 shadow-2xl space-y-5 border border-emerald-700">
        <h1 className="text-3xl font-bold text-center">Белот онлайн</h1>
        <p className="text-center text-emerald-200 text-sm">
          Играй белот с приятели в реално време.
        </p>

        <label className="block">
          <span className="text-emerald-200 text-sm">Прякор</span>
          <input
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            maxLength={20}
            className="mt-1 w-full rounded px-3 py-2 bg-emerald-950 border border-emerald-700 focus:outline-none focus:border-emerald-400 text-white"
            placeholder="напр. Иван"
          />
        </label>

        <button
          onClick={onCreate}
          disabled={busy}
          className="w-full rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-900 font-semibold py-2"
        >
          {busy ? 'Създавам…' : 'Създай нова стая'}
        </button>

        <div className="flex items-center gap-2 text-emerald-300 text-sm">
          <div className="flex-1 border-t border-emerald-700" />
          <span>или се присъедини</span>
          <div className="flex-1 border-t border-emerald-700" />
        </div>

        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="КОД"
            className="flex-1 rounded px-3 py-2 bg-emerald-950 border border-emerald-700 focus:outline-none focus:border-emerald-400 text-white uppercase tracking-widest text-center"
          />
          <button
            onClick={onJoin}
            className="rounded bg-emerald-600 hover:bg-emerald-500 px-4 font-semibold"
          >
            Влез
          </button>
        </div>

        {error && <div className="text-red-300 text-sm text-center">{error}</div>}
      </div>
    </div>
  )
}
