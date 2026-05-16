import {
  RANKS,
  SUITS,
  type Announcement,
  type Card,
  type Contract,
  type Rank,
  type Seat,
  type Suit,
} from '@belot/shared'
import { sequencePos } from './ranking.js'

// Per spec §3:
//   терца (3 consecutive in a suit) = 20
//   кварта (4 consecutive)           = 50
//   квинта+ (5+ consecutive)         = 100
//   каре (four of a kind):
//     Jacks = 200, Nines = 150, A/10/K/Q = 100. No 7s/8s carre.
//   Белот (K+Q of trump, played on consecutive tricks by same player) = 20

export type SequenceCandidate = { suit: Suit; topRank: Rank; length: number; points: number }
export type CarreCandidate = { rank: Rank; points: number }

const CARRE_POINTS: Partial<Record<Rank, number>> = {
  J: 200,
  '9': 150,
  A: 100,
  '10': 100,
  K: 100,
  Q: 100,
}

export function findSequencesInHand(hand: readonly Card[]): SequenceCandidate[] {
  const out: SequenceCandidate[] = []
  for (const suit of SUITS) {
    const ranksInSuit = hand
      .filter((c) => c.suit === suit)
      .map((c) => sequencePos(c.rank))
      .sort((a, b) => a - b)
    if (ranksInSuit.length < 3) continue
    let run: number[] = [ranksInSuit[0]!]
    const finalize = () => {
      if (run.length >= 3) {
        const topIdx = run[run.length - 1]!
        const len = run.length
        const points = len === 3 ? 20 : len === 4 ? 50 : 100
        out.push({ suit, topRank: RANKS[topIdx]!, length: Math.min(len, 5), points })
      }
    }
    for (let i = 1; i < ranksInSuit.length; i++) {
      const r = ranksInSuit[i]!
      if (r === run[run.length - 1]! + 1) {
        run.push(r)
      } else {
        finalize()
        run = [r]
      }
    }
    finalize()
  }
  return out
}

export function findCarresInHand(hand: readonly Card[]): CarreCandidate[] {
  const out: CarreCandidate[] = []
  const counts = new Map<Rank, number>()
  for (const c of hand) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1)
  for (const [rank, n] of counts) {
    if (n === 4 && CARRE_POINTS[rank] !== undefined) {
      out.push({ rank, points: CARRE_POINTS[rank]! })
    }
  }
  return out
}

// Compare two sequences for "highest" announcement rules:
//   1. Longer wins.
//   2. If same length, higher top rank wins.
// (Trump suit tiebreak is applied at team-comparison time, see compareTeamAnnouncements.)
export function compareSequence(a: SequenceCandidate, b: SequenceCandidate): number {
  if (a.length !== b.length) return a.length - b.length
  return sequencePos(a.topRank) - sequencePos(b.topRank)
}

export type SeatAnnouncements = {
  seat: Seat
  sequences: SequenceCandidate[]
  carres: CarreCandidate[]
}

export function scanHand(hand: readonly Card[], seat: Seat): SeatAnnouncements {
  // Belot rule: a single card cannot count toward two separate announcements.
  // The player must pick. Canonical AI choice: take all carrés (always worth more
  // than the sequence portion that would share a card with them), then look for
  // sequences in what's left. Since a carré is by definition all 4 cards of a
  // rank, removing those cards by rank from the hand is safe and complete.
  const carres = findCarresInHand(hand)
  const claimedRanks = new Set<Rank>(carres.map((c) => c.rank))
  const reducedHand = hand.filter((c) => !claimedRanks.has(c.rank))
  const sequences = findSequencesInHand(reducedHand)
  return { seat, sequences, carres }
}

// Resolve which TEAM's announcements count, per spec §3:
//   "Announcement priority: higher announcement wins; if tied, team with the trump-suit
//    announcement wins; if still tied, the team that announced first."
// We assume announcements are declared on first trick by all who have them; the engine
// is given the per-seat scan and the trump suit, and decides which team's announcements
// score (and returns ONLY that team's announcement list).
export type TeamResolution = {
  winningTeam: 'NS' | 'EW' | null // null = no announcements at all
  announcements: Announcement[]
  totalPoints: number
}

export function resolveAnnouncements(
  perSeat: SeatAnnouncements[],
  contract: Contract,
  trump: Suit | null,
): TeamResolution {
  // Carrés trump everything. If both teams have a carré, the higher carré wins outright.
  const allCarres: Array<{ team: 'NS' | 'EW'; seat: Seat; c: CarreCandidate }> = []
  for (const s of perSeat) {
    const team: 'NS' | 'EW' = s.seat === 0 || s.seat === 2 ? 'NS' : 'EW'
    for (const c of s.carres) allCarres.push({ team, seat: s.seat, c })
  }
  if (allCarres.length > 0) {
    // Highest carré wins; carré ordering by points (J=200 > 9=150 > rest=100); ties broken by
    // team-declared-first (we approximate using seat order from firstBidder = irrelevant here;
    // we use seat number as a stable order — caller can re-order if a different tiebreak is desired).
    allCarres.sort((a, b) => b.c.points - a.c.points || a.seat - b.seat)
    const winningTeam = allCarres[0]!.team
    const ours = allCarres.filter((x) => x.team === winningTeam)
    // The winning team ALSO scores all their sequences. (Standard rule.)
    const winningSeqs = perSeat
      .filter((s) => (s.seat === 0 || s.seat === 2 ? 'NS' : 'EW') === winningTeam)
      .flatMap((s) => s.sequences.map((sq) => ({ seat: s.seat, sq })))
    const anns: Announcement[] = [
      ...ours.map((x) => ({ kind: 'carre' as const, seat: x.seat, rank: x.c.rank, points: x.c.points })),
      ...winningSeqs.map((x) => ({
        kind: 'sequence' as const,
        seat: x.seat,
        suit: x.sq.suit,
        topRank: x.sq.topRank,
        length: x.sq.length,
        points: x.sq.points,
      })),
    ]
    return {
      winningTeam,
      announcements: anns,
      totalPoints: anns.reduce((s, a) => s + a.points, 0),
    }
  }

  // No carrés. Compare best sequences across teams.
  const bestPerSeat = perSeat.map((s) => {
    if (s.sequences.length === 0) return { seat: s.seat, best: null as SequenceCandidate | null }
    let best = s.sequences[0]!
    for (let i = 1; i < s.sequences.length; i++) {
      if (compareSequence(s.sequences[i]!, best) > 0) best = s.sequences[i]!
    }
    return { seat: s.seat, best }
  })
  const bestNS = bestOf(bestPerSeat.filter((x) => x.seat === 0 || x.seat === 2), trump, contract)
  const bestEW = bestOf(bestPerSeat.filter((x) => x.seat === 1 || x.seat === 3), trump, contract)

  if (!bestNS && !bestEW) return { winningTeam: null, announcements: [], totalPoints: 0 }
  if (!bestNS) return collectTeam('EW', perSeat)
  if (!bestEW) return collectTeam('NS', perSeat)

  const cmp = compareSequence(bestNS.best!, bestEW.best!)
  let winner: 'NS' | 'EW'
  if (cmp > 0) winner = 'NS'
  else if (cmp < 0) winner = 'EW'
  else {
    // Tied on length AND top rank. Trump-suit tiebreak.
    const nsTrump = trump !== null && bestNS.best!.suit === trump
    const ewTrump = trump !== null && bestEW.best!.suit === trump
    if (nsTrump && !ewTrump) winner = 'NS'
    else if (ewTrump && !nsTrump) winner = 'EW'
    else {
      // Still tied → the team that announced first. In our model both announce on trick 1
      // simultaneously, so we fall back to the team whose seat is closer to firstBidder
      // (dealer+1). Caller passes perSeat already in announce order. We tiebreak by
      // *lowest seat number among declarers* for determinism.
      const nsSeat = Math.min(...bestPerSeat.filter((x) => (x.seat === 0 || x.seat === 2) && x.best).map((x) => x.seat))
      const ewSeat = Math.min(...bestPerSeat.filter((x) => (x.seat === 1 || x.seat === 3) && x.best).map((x) => x.seat))
      winner = nsSeat <= ewSeat ? 'NS' : 'EW'
    }
  }
  return collectTeam(winner, perSeat)
}

function bestOf(
  arr: { seat: Seat; best: SequenceCandidate | null }[],
  _trump: Suit | null,
  _contract: Contract,
): { seat: Seat; best: SequenceCandidate | null } | null {
  const real = arr.filter((x) => x.best)
  if (real.length === 0) return null
  let top = real[0]!
  for (let i = 1; i < real.length; i++) if (compareSequence(real[i]!.best!, top.best!) > 0) top = real[i]!
  return top
}

function collectTeam(team: 'NS' | 'EW', perSeat: SeatAnnouncements[]): TeamResolution {
  const ours = perSeat.filter((s) => (s.seat === 0 || s.seat === 2 ? 'NS' : 'EW') === team)
  const anns: Announcement[] = [
    ...ours.flatMap((s) =>
      s.sequences.map((sq) => ({
        kind: 'sequence' as const,
        seat: s.seat,
        suit: sq.suit,
        topRank: sq.topRank,
        length: sq.length,
        points: sq.points,
      })),
    ),
    ...ours.flatMap((s) =>
      s.carres.map((c) => ({ kind: 'carre' as const, seat: s.seat, rank: c.rank, points: c.points })),
    ),
  ]
  return {
    winningTeam: team,
    announcements: anns,
    totalPoints: anns.reduce((sum, a) => sum + a.points, 0),
  }
}

// Detect that a player holds both K and Q of trump (precondition for белот).
export function holdsBelotPair(hand: readonly Card[], trump: Suit | null): boolean {
  if (trump === null) return false
  const hasK = hand.some((c) => c.suit === trump && c.rank === 'K')
  const hasQ = hand.some((c) => c.suit === trump && c.rank === 'Q')
  return hasK && hasQ
}
