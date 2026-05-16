import type { Announcement, Contract, Multiplier, Seat, Suit, Team } from '@belot/shared'
import { teamOf } from '@belot/shared'

// Outcome categories per belot.bg:
//   'made'      = изкарана  — bidder strictly outscored defenders; each team keeps its own.
//   'inside'    = вкарана  — defenders strictly outscored bidder; defenders take EVERYTHING.
//   'suspended' = висяща   — equal totals; bidder's points "hang" for the next hand winner.
export type HandOutcome = 'made' | 'inside' | 'suspended'

export type HandResult = {
  cardPoints: { NS: number; EW: number }
  announcementPoints: { NS: number; EW: number }
  belotPoints: { NS: number; EW: number }
  lastTrickBonusTeam: Team
  capot: Team | null
  // Raw points awarded this hand, BEFORE the /10 round-down to match tens.
  // Match layer is responsible for converting to tens and applying carry.
  awardedRaw: { NS: number; EW: number }
  // If outcome === 'suspended', bidder's raw points sit here for carry; awardedRaw[bidder] == 0.
  suspendedRaw: number
  outcome: HandOutcome
  insideAppliedAgainst: Team | null // 'NS' means NS was the bidder and went inside
}

export type HandInputs = {
  contract: Contract
  bidder: Seat
  multiplier: Multiplier
  trickPoints: { NS: number; EW: number } // raw points (NO last-trick bonus)
  tricksWon: { NS: number; EW: number }   // counts (0..8) — to detect капо
  lastTrickWinnerTeam: Team
  announcements: Announcement[]           // already team-resolved (only the winning team's list)
  belotDeclaredBy: Seat | null            // seat that completed K+Q of trump played consecutively
  // When false, the +90 capot bonus is NOT multiplied by contra/re-contra.
  // Default true (matches the most common variant).
  capotDoubledByContra?: boolean
}

// Compute hand result in RAW points. Match layer (match.ts) handles /10 rounding and carry.
// Per belot.bg:
//   - изкарана: bidder > defender → each team keeps own
//   - вкарана:  bidder < defender → defenders take everything (announcements + capot + bidder's cards). Belot stays with declarer.
//   - висяща:  bidder == defender → bidder scores 0; bidder's raw total hangs for next hand winner; defenders keep own
//   - Multiplier ×2 / ×4 multiplies ALL awarded points & premiums.
//   - NT: card points × 2 (capot bonus NOT doubled). No announcements in NT — caller should pass [].
//   - AT: card points kept as-is.
export function scoreHand(input: HandInputs): HandResult {
  const bidderTeam = teamOf(input.bidder)
  void (bidderTeam) // referenced below

  // 1. card points + last-trick bonus
  const lastBonus = 10
  let cardNS = input.trickPoints.NS + (input.lastTrickWinnerTeam === 'NS' ? lastBonus : 0)
  let cardEW = input.trickPoints.EW + (input.lastTrickWinnerTeam === 'EW' ? lastBonus : 0)

  // 2. NT card-point doubling
  if (input.contract === 'NT') {
    cardNS *= 2
    cardEW *= 2
  }

  // 3. announcements → team buckets. In NT no announcements should be present
  //    (caller enforces); we still bucket whatever was passed.
  let annNS = 0
  let annEW = 0
  for (const a of input.announcements) {
    const t = teamOf(a.seat)
    const pts = a.points // announcements not doubled in NT (already disabled there)
    if (t === 'NS') annNS += pts
    else annEW += pts
  }

  // 4. belot (+20) — never in NT
  let belNS = 0
  let belEW = 0
  if (input.belotDeclaredBy !== null && input.contract !== 'NT') {
    if (teamOf(input.belotDeclaredBy) === 'NS') belNS = 20
    else belEW = 20
  }

  // 5. capot (+90, NOT doubled by NT but IS multiplied by contra/recontra)
  let capot: Team | null = null
  let capotNS = 0
  let capotEW = 0
  if (input.tricksWon.NS === 8) { capot = 'NS'; capotNS = 90 }
  else if (input.tricksWon.EW === 8) { capot = 'EW'; capotEW = 90 }

  // 6. team totals BEFORE inside/suspended adjustment
  const totalNS = cardNS + annNS + belNS + capotNS
  const totalEW = cardEW + annEW + belEW + capotEW
  const bidderTotal = bidderTeam === 'NS' ? totalNS : totalEW
  const defTotal    = bidderTeam === 'NS' ? totalEW : totalNS

  let awardedNS = 0
  let awardedEW = 0
  let suspendedRaw = 0
  let outcome: HandOutcome
  let inside: Team | null = null

  if (bidderTotal > defTotal) {
    // изкарана — each team keeps its own
    outcome = 'made'
    awardedNS = totalNS
    awardedEW = totalEW
  } else if (bidderTotal < defTotal) {
    // вкарана — defenders take ALL card points + announcements + capot.
    // Bidder's belot stays with declarer (common BG convention).
    outcome = 'inside'
    inside = bidderTeam
    if (bidderTeam === 'NS') {
      awardedNS = belNS
      awardedEW = totalEW + cardNS + annNS + capotNS
    } else {
      awardedEW = belEW
      awardedNS = totalNS + cardEW + annEW + capotEW
    }
  } else {
    // висяща — bidder scores 0, their points hang. Defenders keep own.
    outcome = 'suspended'
    suspendedRaw = bidderTotal
    if (bidderTeam === 'NS') {
      awardedNS = belNS // belot still records (sit with declarer)
      awardedEW = totalEW
    } else {
      awardedEW = belEW
      awardedNS = totalNS
    }
  }

  // 7. multiplier applies to all awarded points and to the suspended pool.
  //    Optionally exempt the +90 capot bonus when capotDoubledByContra is false.
  const capotDoubled = input.capotDoubledByContra !== false // default true
  awardedNS *= input.multiplier
  awardedEW *= input.multiplier
  suspendedRaw *= input.multiplier

  if (!capotDoubled && capot && input.multiplier > 1) {
    // Undo the extra multiplication on the 90-point capot bonus.
    // The capot ALWAYS ends up with whichever team scored more this hand:
    //   - made: with the team that took 8 tricks (= capot)
    //   - inside: defenders take the bidder's capot (transferred above)
    //   - suspended with a capot is essentially impossible (capot makes one team's total dwarf the other)
    const extra = (input.multiplier - 1) * 90
    let capotEndedWith: Team = capot
    if (outcome === 'inside' && capot === bidderTeam) {
      capotEndedWith = bidderTeam === 'NS' ? 'EW' : 'NS'
    }
    if (capotEndedWith === 'NS') awardedNS -= extra
    else awardedEW -= extra
  }

  return {
    cardPoints: { NS: cardNS, EW: cardEW },
    announcementPoints: { NS: annNS, EW: annEW },
    belotPoints: { NS: belNS, EW: belEW },
    lastTrickBonusTeam: input.lastTrickWinnerTeam,
    capot,
    awardedRaw: { NS: awardedNS, EW: awardedEW },
    suspendedRaw,
    outcome,
    insideAppliedAgainst: inside,
  }
}

// Convert raw card-pool points to match "tens" (the unit the scoreboard tracks).
// Source: belot.bg — "разделени на 10 и закръглени до цяло число".
// Half-up rounding for MVP; specific AT/висящ edge cases simplified.
export function toTens(rawPoints: number): number {
  if (rawPoints <= 0) return 0
  return Math.round(rawPoints / 10)
}

// (kept for tests that imported it under the old name)
export type { Team, Suit, Contract }
