import { z } from 'zod'

// ─── Cards ────────────────────────────────────────────────────────────────
export const SUITS = ['C', 'D', 'H', 'S'] as const
export const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const

export type Suit = (typeof SUITS)[number]
export type Rank = (typeof RANKS)[number]

export const CardSchema = z.object({
  suit: z.enum(SUITS),
  rank: z.enum(RANKS),
})
export type Card = z.infer<typeof CardSchema>

// ─── Seats & teams ────────────────────────────────────────────────────────
// Seating: 0=South (you), 1=West, 2=North, 3=East. Teams: (0,2) NS vs (1,3) EW.
export const SEATS = [0, 1, 2, 3] as const
export type Seat = (typeof SEATS)[number]
export type Team = 'NS' | 'EW'

export const teamOf = (seat: Seat): Team => (seat === 0 || seat === 2 ? 'NS' : 'EW')
export const partnerOf = (seat: Seat): Seat => ((seat + 2) % 4) as Seat
export const nextSeat = (seat: Seat): Seat => ((seat + 1) % 4) as Seat

// ─── Contracts ────────────────────────────────────────────────────────────
// Per spec §3: ranking AT > NT > S > H > D > C; PASS is non-bid.
export const BID_CONTRACTS = ['C', 'D', 'H', 'S', 'NT', 'AT'] as const
export type BidContract = (typeof BID_CONTRACTS)[number]
export type Contract = BidContract // resolved contract (never PASS)

export const bidRank = (c: BidContract): number => BID_CONTRACTS.indexOf(c)

export type Multiplier = 1 | 2 | 4 // 1 = normal, 2 = contra, 4 = re-contra

// ─── Actions (player intents) ─────────────────────────────────────────────
export const BidActionSchema = z.object({
  type: z.literal('BID'),
  seat: z.number().int().min(0).max(3),
  contract: z.enum(BID_CONTRACTS),
})
export const PassActionSchema = z.object({
  type: z.literal('PASS'),
  seat: z.number().int().min(0).max(3),
})
export const ContraActionSchema = z.object({
  type: z.literal('CONTRA'),
  seat: z.number().int().min(0).max(3),
})
export const RecontraActionSchema = z.object({
  type: z.literal('RECONTRA'),
  seat: z.number().int().min(0).max(3),
})
export const PlayCardActionSchema = z.object({
  type: z.literal('PLAY'),
  seat: z.number().int().min(0).max(3),
  card: CardSchema,
})
export const AnnounceBelotActionSchema = z.object({
  type: z.literal('BELOT',),
  seat: z.number().int().min(0).max(3),
})

export const ActionSchema = z.discriminatedUnion('type', [
  BidActionSchema,
  PassActionSchema,
  ContraActionSchema,
  RecontraActionSchema,
  PlayCardActionSchema,
  AnnounceBelotActionSchema,
])
export type Action = z.infer<typeof ActionSchema>

// ─── Announcements ────────────────────────────────────────────────────────
// 'sequence' = терца (3) / кварта (4) / квинта+ (5+); 'carre' = four of a kind.
export type Announcement =
  | { kind: 'sequence'; seat: Seat; suit: Suit; topRank: Rank; length: number; points: number }
  | { kind: 'carre'; seat: Seat; rank: Rank; points: number }
  | { kind: 'belot'; seat: Seat; suit: Suit; points: 20 }

// ─── Phase ────────────────────────────────────────────────────────────────
export type Phase = 'DEALING' | 'BIDDING' | 'PLAYING' | 'SCORING' | 'HAND_OVER' | 'GAME_OVER'

// ─── Snapshot (full state, server-only) & PlayerView (per-seat, safe to send)
export type Trick = {
  leader: Seat
  cards: ReadonlyArray<{ seat: Seat; card: Card }> // 0..4 entries
}

export type RoomSettings = {
  gameTo: number // default 151
  enableNT: boolean
  enableAT: boolean
  turnTimerSec: number
  allowSpectators: boolean
  botsFillEmpty: boolean
}

export const DEFAULT_SETTINGS: RoomSettings = {
  gameTo: 151,
  enableNT: true,
  enableAT: true,
  turnTimerSec: 30,
  allowSpectators: true,
  botsFillEmpty: true,
}

export type Score = { NS: number; EW: number }

export type BidHistoryEntry =
  | { type: 'PASS'; seat: Seat }
  | { type: 'BID'; seat: Seat; contract: BidContract }
  | { type: 'CONTRA'; seat: Seat }
  | { type: 'RECONTRA'; seat: Seat }

export type GameSnapshot = {
  phase: Phase
  dealer: Seat
  turn: Seat
  hands: Record<Seat, Card[]> // hidden info
  contract: Contract | null
  trump: Suit | null // null in NT, set in C/D/H/S/AT
  bidder: Seat | null // seat that named the contract
  multiplier: Multiplier
  bidHistory: BidHistoryEntry[]
  passesInARow: number
  bidsMadeThisHand: number // to detect 4-pass redeal vs end-of-bidding
  currentTrick: Trick | null
  completedTricks: Array<{
    leader: Seat
    cards: ReadonlyArray<{ seat: Seat; card: Card }>
    winner: Seat
    points: number
  }>
  announcements: Announcement[]
  belotIntent: { seat: Seat; played: number } | null // tracks belot K/Q-of-trump play sequence
  matchScore: Score
  handNo: number
  settings: RoomSettings
  rngSeed: number
  // "Висяща" carry-over: bidder's points from a suspended hand wait here for the
  // team that wins the next non-suspended hand. Already in "tens" (i.e. /10 rounded).
  hungPool: { points: number } | null
  // The result of the most recently completed hand — kept so the client can show
  // the score breakdown across the start of the next hand. Cleared on a new finalize.
  lastHandResult: LastHandResult | null
  // Append-only log of every finished hand in the match, for the score-board history view.
  handHistory: LastHandResult[]
}

export type LastHandResult = {
  handNo: number
  contract: Contract
  bidder: Seat
  multiplier: Multiplier
  cardPoints: Score        // raw card pool incl. last-trick bonus
  announcementPoints: Score
  belotPoints: Score
  capot: Team | null
  awardedRaw: Score        // before /10
  awardedTens: Score       // what was added to matchScore
  outcome: 'made' | 'inside' | 'suspended'
  announcements: Announcement[] // combinations that scored this hand
}

export type PlayerView = {
  you: Seat
  phase: Phase
  dealer: Seat
  turn: Seat
  yourHand: Card[]
  handCounts: Record<Seat, number>
  contract: Contract | null
  trump: Suit | null
  bidder: Seat | null
  multiplier: Multiplier
  bidHistory: BidHistoryEntry[]
  currentTrick: Trick | null
  lastTrick: { winner: Seat; cards: ReadonlyArray<{ seat: Seat; card: Card }> } | null
  announcements: Announcement[]
  matchScore: Score
  handNo: number
  settings: RoomSettings
  hungPool: { points: number } | null
  lastHandResult: LastHandResult | null
  // Append-only log of every finished hand in the match (for score-board history).
  handHistory: LastHandResult[]
  // Combinations the receiving player holds in their *own* hand (or held before
  // playing — reconstructs the original deal). Useful for "you can announce X"
  // hints before trick 1 resolves announcements team-wide.
  yourPotentialAnnouncements: Announcement[]
}
