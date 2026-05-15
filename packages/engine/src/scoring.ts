import type { Announcement, Contract, Multiplier, Seat, Suit, Team } from '@belot/shared'
import { teamOf } from '@belot/shared'

export type HandResult = {
  cardPoints: { NS: number; EW: number }
  announcementPoints: { NS: number; EW: number }
  belotPoints: { NS: number; EW: number }
  lastTrickBonusTeam: Team
  capot: Team | null
  awarded: { NS: number; EW: number }
  insideAppliedAgainst: Team | null // 'NS' means bidder team was NS and went inside
}

export type HandInputs = {
  contract: Contract
  bidder: Seat
  multiplier: Multiplier
  trickPoints: { NS: number; EW: number } // raw points (NO last-trick bonus)
  tricksWon: { NS: number; EW: number }   // counts (0..8) — to detect капо
  lastTrickWinnerTeam: Team
  announcements: Announcement[]           // already team-resolved (only the winning team's list)
  belotDeclaredBy: Seat | null            // seat that completed K+Q of trump played on consecutive tricks
}

// 162-point reference for trump suit contracts; 258 for AT (with halving variant differences); 130 for NT (doubled).
// We follow the spec §3 + clarified default: NT totals doubled.
//
// Rounding rule for inside detection: bidder team must score STRICTLY MORE than defenders to "make" the contract.
// Equal → bidder goes inside (вътре); defenders take everything.
//
// We compute in this order (standard BG belote):
//   1. Sum card points + last-trick +10 → cardPoints per team.
//   2. Add announcements (already team-resolved).
//   3. Add белот (+20) to the team of belotDeclaredBy if any.
//   4. Detect капо: if one team won all 8 tricks → +90 to them.
//   5. Determine inside: bidder team's total (cards+ann+belot+capot) must exceed defenders' total.
//   6. If inside: defenders get bidder's card+ann+capot points TOO. Белот always stays with the declarer
//      (standard rule). Some variants assign all to defenders — we follow "belot stays."
//   7. Apply multiplier to FINAL awarded points (contra ×2, re-contra ×4).
//   8. NT contract → double card points (announcements already at face).
//   9. AT contract → leave as is (we keep raw 258 pool).
//
// The exact "halving" variants for AT vary; this implementation uses raw points and the +10 last-trick.
export function scoreHand(input: HandInputs): HandResult {
  const bidderTeam = teamOf(input.bidder)
  const defTeam: Team = bidderTeam === 'NS' ? 'EW' : 'NS'

  // 1. card points + last trick
  const lastBonus = 10
  let cardNS = input.trickPoints.NS + (input.lastTrickWinnerTeam === 'NS' ? lastBonus : 0)
  let cardEW = input.trickPoints.EW + (input.lastTrickWinnerTeam === 'EW' ? lastBonus : 0)

  // NT doubling
  if (input.contract === 'NT') {
    cardNS *= 2
    cardEW *= 2
  }

  // 2. announcements → team buckets
  let annNS = 0
  let annEW = 0
  for (const a of input.announcements) {
    const t = teamOf(a.seat)
    const pts = input.contract === 'NT' ? a.points * 2 : a.points
    if (t === 'NS') annNS += pts
    else annEW += pts
  }

  // 3. belot
  let belNS = 0
  let belEW = 0
  if (input.belotDeclaredBy !== null) {
    if (teamOf(input.belotDeclaredBy) === 'NS') belNS = 20
    else belEW = 20
  }

  // 4. capot
  let capot: Team | null = null
  let capotNS = 0
  let capotEW = 0
  if (input.tricksWon.NS === 8) {
    capot = 'NS'
    capotNS = 90
  } else if (input.tricksWon.EW === 8) {
    capot = 'EW'
    capotEW = 90
  }

  // 5. inside detection: total per team
  const totalNS = cardNS + annNS + belNS + capotNS
  const totalEW = cardEW + annEW + belEW + capotEW
  const bidderTotal = bidderTeam === 'NS' ? totalNS : totalEW
  const defTotal = bidderTeam === 'NS' ? totalEW : totalNS

  let awardedNS = totalNS
  let awardedEW = totalEW
  let inside: Team | null = null

  if (bidderTotal <= defTotal) {
    inside = bidderTeam
    // Defenders take bidder's cards+ann+capot. Bidder's belot stays.
    if (bidderTeam === 'NS') {
      awardedNS = belNS // keep only belot
      awardedEW = totalEW + cardNS + annNS + capotNS
    } else {
      awardedEW = belEW
      awardedNS = totalNS + cardEW + annEW + capotEW
    }
  }

  // 7. multiplier
  awardedNS = awardedNS * input.multiplier
  awardedEW = awardedEW * input.multiplier

  // BG convention: scores are typically rounded to nearest 10, with floor rules. Many sites
  // skip rounding for app simplicity. We don't round here; rounding can be a settings flag.

  return {
    cardPoints: { NS: cardNS, EW: cardEW },
    announcementPoints: { NS: annNS, EW: annEW },
    belotPoints: { NS: belNS, EW: belEW },
    lastTrickBonusTeam: input.lastTrickWinnerTeam,
    capot,
    awarded: { NS: awardedNS, EW: awardedEW },
    insideAppliedAgainst: inside,
  }
}
