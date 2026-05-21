import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Flourish, Monogram } from './Ornaments.js'
import { useGame } from '../store/game.js'
import { useT } from '../i18n/index.js'

// Victory / defeat cinematic — per design spec §12.
// Renders inline on the Table when view.phase === 'GAME_OVER'.
// Tier A cinematic: brass glow over winner side, ember glow over loser side,
// 400ms fade-in with single upward translate (per spec §Animation Rules).
// Hand-by-hand history is collapsed by default; toggled by clicking "История".
export function VictoryOverlay() {
  const t = useT()
  const view = useGame((s) => s.view)!
  const room = useGame((s) => s.room)!
  const mySeat = useGame((s) => s.mySeat)

  // Match persistence is server-authoritative (the game server writes the row
  // via the service role on GAME_OVER). The client no longer writes results —
  // this prevents leaderboard/stat forgery (audit SEC-001).

  const nsWon = view.matchScore.NS > view.matchScore.EW
  const myTeam: 'NS' | 'EW' | null =
    mySeat === null ? null : mySeat === 0 || mySeat === 2 ? 'NS' : 'EW'
  const iWon = myTeam === (nsWon ? 'NS' : 'EW')

  // Roster lines per team.
  const ns = [room.seats[0], room.seats[2]]
  const ew = [room.seats[1], room.seats[3]]

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-void/80 backdrop-blur-md">
      {/* Brass glow on the winning side, ember on losing — purely decorative */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: nsWon
            ? 'radial-gradient(circle at 30% 40%, rgba(201,162,90,.5), transparent 50%), radial-gradient(circle at 70% 60%, rgba(125,31,43,.4), transparent 50%)'
            : 'radial-gradient(circle at 70% 40%, rgba(201,162,90,.5), transparent 50%), radial-gradient(circle at 30% 60%, rgba(125,31,43,.4), transparent 50%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-2xl mx-4 plate p-6 sm:p-10 text-center"
      >
        <div className="flex justify-center mb-3">
          <Monogram size={52} />
        </div>

        <div className="eyebrow eyebrow-active mb-2">{t('victory.subtitle')}</div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className={`font-display italic font-bold leading-none ${
            iWon ? 'text-brass-hi' : myTeam ? 'text-ash' : 'text-cream'
          }`}
          style={{ fontSize: 'clamp(48px, 9vw, 96px)' }}
        >
          {iWon || myTeam === null ? t('victory.title') : t('victory.defeatTitle')}
        </motion.h1>

        <Flourish className="w-56 mx-auto mt-4 text-brass/50" />

        {/* Score line — large mono, brass-hi for winner team */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.22, duration: 0.4 }}
          className="grid grid-cols-2 mt-6 gap-2"
        >
          <TeamColumn
            label={t('table.teamNS')}
            score={view.matchScore.NS}
            members={ns.map((s) => s?.nickname ?? '—')}
            winner={nsWon}
          />
          <TeamColumn
            label={t('table.teamEW')}
            score={view.matchScore.EW}
            members={ew.map((s) => s?.nickname ?? '—')}
            winner={!nsWon}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="mt-8 flex flex-col sm:flex-row gap-3 justify-center"
        >
          <Link to="/" className="btn-brass">
            {t('victory.newGame')}
          </Link>
          <Link to="/tablo" className="btn-ghost">
            {t('victory.lobby')}
          </Link>
        </motion.div>

        {view.handHistory.length > 0 && (
          <div className="mt-5">
            <details className="text-left">
              <summary className="font-mono text-[11px] tracking-[0.22em] uppercase text-ash hover:text-brass-hi cursor-pointer inline-block">
                {t('victory.handHistory')} ({view.handHistory.length})
              </summary>
              <div className="mt-3 max-h-64 overflow-y-auto plate-cream p-3 rounded">
                <table className="w-full text-[11px] font-mono">
                  <thead>
                    <tr className="text-stone-600">
                      <th className="text-left py-1">#</th>
                      <th className="text-left py-1">{t('table.contract')}</th>
                      <th className="text-right py-1">NS</th>
                      <th className="text-right py-1">EW</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.handHistory.map((h, i) => (
                      <tr key={i} className="border-t border-stone-300/40">
                        <td className="py-1 text-stone-600">{h.handNo}</td>
                        <td className="py-1 text-stone-800">
                          {h.contract}
                          {h.multiplier > 1 && (
                            <span className="ml-1 text-ember">×{h.multiplier}</span>
                          )}
                        </td>
                        <td className="py-1 text-right text-stone-900">{h.awardedTens.NS}</td>
                        <td className="py-1 text-right text-stone-900">{h.awardedTens.EW}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        )}
      </motion.div>
    </div>
  )
}

function TeamColumn({
  label,
  score,
  members,
  winner,
}: {
  label: string
  score: number
  members: string[]
  winner: boolean
}) {
  return (
    <div className={`p-4 rounded ${winner ? 'plate-cream' : 'bg-ink/40 border border-ash/15'}`}>
      <div
        className={`font-mono text-[10px] tracking-[0.22em] uppercase ${
          winner ? 'text-stone-700' : 'text-ash'
        }`}
      >
        {label}
      </div>
      <div
        className={`font-display font-bold leading-none mt-2 ${
          winner ? 'text-stone-900 text-5xl' : 'text-cream/85 text-4xl'
        }`}
      >
        {score}
      </div>
      <div className={`mt-2 font-display italic text-xs ${winner ? 'text-stone-700' : 'text-cream/55'}`}>
        {members.join(' · ')}
      </div>
    </div>
  )
}
