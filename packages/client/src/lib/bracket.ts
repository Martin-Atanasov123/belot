// Pure TypeScript bracket logic for single-elimination tournaments.
// No IO, no Supabase — used both by the seeding flow and by the bracket SVG.
//
// Bracket sizes: 4, 8, 16, 32 (powers of two only).
// Round numbering: 1 = first round, log2(size) = final.

export type BracketSize = 4 | 8 | 16 | 32

export function isValidBracketSize(n: number): n is BracketSize {
  return n === 4 || n === 8 || n === 16 || n === 32
}

// Number of rounds to play out the full bracket.
export function roundCount(size: BracketSize): number {
  return Math.log2(size) // 4→2, 8→3, 16→4, 32→5
}

// Number of matches in round r (1-indexed). Round 1 has size/2 matches; each
// subsequent round halves that count.
export function matchesInRound(size: BracketSize, round: number): number {
  return Math.max(1, size / Math.pow(2, round))
}

// Human-readable label for a round. For 8-player brackets: R1 → "QF",
// R2 → "SF", R3 → "F". Scales for 4/16/32.
export function roundLabel(size: BracketSize, round: number): string {
  const total = roundCount(size)
  const fromFinal = total - round // 0 = final, 1 = semi, 2 = quarter, ...
  if (fromFinal === 0) return 'F'
  if (fromFinal === 1) return 'SF'
  if (fromFinal === 2) return 'QF'
  if (fromFinal === 3) return 'R16'
  return `R${round}`
}

// Standard single-elimination seeding for a bracket of size N.
// Result[i] = seed-number that should occupy slot i in round 1.
//
// For size=8: [1, 8, 5, 4, 3, 6, 7, 2]
// Match 1: seeds 1 v 8, Match 2: 5 v 4, Match 3: 3 v 6, Match 4: 7 v 2.
// Winners of (1,2) meet in SF1; winners of (3,4) meet in SF2; SF winners → F.
export function standardSeedOrder(size: BracketSize): number[] {
  // Iterative algorithm: start with [1] and at each step expand each entry s
  // to [s, size+1-s] in a paired/mirrored layout.
  let arr: number[] = [1]
  while (arr.length < size) {
    const expanded = arr.length * 2
    const next: number[] = new Array(arr.length * 2)
    for (let i = 0; i < arr.length; i++) {
      next[i * 2] = arr[i]!
      next[i * 2 + 1] = expanded + 1 - arr[i]!
    }
    arr = next
  }
  return arr
}

// Given an unseeded list of player IDs (already shuffled or sorted by skill),
// return them ordered into round-1 slots using standard pairings.
// Pads with `null` (BYE) if players.length < size.
export function seedPlayersIntoSlots(players: string[], size: BracketSize): Array<string | null> {
  const order = standardSeedOrder(size)
  // Pad players list with nulls so we can index by seed number safely.
  const padded: Array<string | null> = [...players]
  while (padded.length < size) padded.push(null)
  // order[i] is 1-indexed seed → players are 0-indexed.
  return order.map((seed) => padded[seed - 1] ?? null)
}

// Compute round-1 matches from a slot-ordered list of size players.
// Returns pairs of consecutive slots: (slot 0, slot 1), (slot 2, slot 3), …
export function buildRound1Matches(
  slottedPlayers: Array<string | null>,
): Array<{ slot: number; playerA: string | null; playerB: string | null }> {
  const matches: Array<{ slot: number; playerA: string | null; playerB: string | null }> = []
  for (let i = 0; i < slottedPlayers.length; i += 2) {
    matches.push({
      slot: i / 2,
      playerA: slottedPlayers[i] ?? null,
      playerB: slottedPlayers[i + 1] ?? null,
    })
  }
  return matches
}

// Compute the parent slot in round (r+1) that the winner of (round r, slot s) feeds into.
// slot s in round r → slot ⌊s/2⌋ in round (r+1), as player_a (even s) or player_b (odd s).
export function parentSlot(slot: number): { slot: number; side: 'A' | 'B' } {
  return { slot: slot >> 1, side: slot % 2 === 0 ? 'A' : 'B' }
}

// Fisher-Yates shuffle using a non-cryptographic RNG. Used for fair MVP seeding
// (no skill rating yet). Server side could use a seeded RNG for replayability.
export function shuffle<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

// One-shot helper: from a list of registered player IDs and a bracket size,
// produce the round-1 match plan ready to insert into tournament_matches.
// If players.length > size, extras are dropped (caller should validate first).
// If players.length < size, missing slots become BYEs (null) which auto-advance.
export function planRound1(players: string[], size: BracketSize): Array<{
  slot: number
  playerA: string | null
  playerB: string | null
}> {
  const slotted = seedPlayersIntoSlots(players, size)
  return buildRound1Matches(slotted)
}

// Walk every (round, slot) coordinate in display order — useful when rendering
// an SVG or listing matches by round.
export function* allBracketCoords(size: BracketSize): Generator<{ round: number; slot: number }> {
  const rounds = roundCount(size)
  for (let r = 1; r <= rounds; r++) {
    const slots = matchesInRound(size, r)
    for (let s = 0; s < slots; s++) yield { round: r, slot: s }
  }
}
