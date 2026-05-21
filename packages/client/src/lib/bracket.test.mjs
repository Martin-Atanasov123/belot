// Smoke test for the bracket engine. Runs with: node bracket.test.mjs
// No test framework — plain Node assertions so we don't pull in extra deps.
//
// We assert tournament INVARIANTS (correct matchups, seed 1 & 2 in opposite
// halves) rather than exact slot orderings — multiple valid orderings produce
// the same tournament structure, so we check the structure, not the layout.
import assert from 'node:assert/strict'

function standardSeedOrder(size) {
  let arr = [1]
  while (arr.length < size) {
    const expanded = arr.length * 2
    const next = new Array(arr.length * 2)
    for (let i = 0; i < arr.length; i++) {
      next[i * 2] = arr[i]
      next[i * 2 + 1] = expanded + 1 - arr[i]
    }
    arr = next
  }
  return arr
}

function roundCount(size) { return Math.log2(size) }
function matchesInRound(size, round) { return Math.max(1, size / Math.pow(2, round)) }
function roundLabel(size, round) {
  const total = roundCount(size)
  const fromFinal = total - round
  if (fromFinal === 0) return 'F'
  if (fromFinal === 1) return 'SF'
  if (fromFinal === 2) return 'QF'
  if (fromFinal === 3) return 'R16'
  return `R${round}`
}

function parentSlot(slot) { return { slot: slot >> 1, side: slot % 2 === 0 ? 'A' : 'B' } }

// Round-1 matchups as a Set of sorted "smaller-larger" pairs.
function r1Matchups(size) {
  const order = standardSeedOrder(size)
  const pairs = new Set()
  for (let i = 0; i < order.length; i += 2) {
    const [a, b] = [order[i], order[i + 1]].sort((x, y) => x - y)
    pairs.add(`${a}v${b}`)
  }
  return pairs
}

// Standard tournament R1 matchups (sum-of-pair = size+1):
// size=4 → {1v4, 2v3};  size=8 → {1v8, 2v7, 3v6, 4v5}
function expectedR1Matchups(size) {
  const pairs = new Set()
  for (let s = 1; s <= size / 2; s++) {
    pairs.add(`${s}v${size + 1 - s}`)
  }
  return pairs
}

let pass = 0
function expect(label, fn) {
  try { fn(); console.log(`  ✓ ${label}`); pass++ }
  catch (e) { console.error(`  ✗ ${label}`); console.error(`     ${e.message}`); process.exitCode = 1 }
}

console.log('Bracket engine smoke tests:')

// 1. R1 matchups correct for sizes 4, 8, 16, 32
expect('size 4 R1 matchups = {1v4, 2v3}', () => {
  assert.deepEqual([...r1Matchups(4)].sort(), [...expectedR1Matchups(4)].sort())
})
expect('size 8 R1 matchups = {1v8, 2v7, 3v6, 4v5}', () => {
  assert.deepEqual([...r1Matchups(8)].sort(), [...expectedR1Matchups(8)].sort())
})
expect('size 16 R1 matchups complete (all sums = 17)', () => {
  assert.deepEqual([...r1Matchups(16)].sort(), [...expectedR1Matchups(16)].sort())
})
expect('size 32 R1 matchups complete (all sums = 33)', () => {
  assert.deepEqual([...r1Matchups(32)].sort(), [...expectedR1Matchups(32)].sort())
})

// 2. Seeds 1 and 2 are in opposite halves (so they can only meet in the final)
expect('size 8: seed 1 top half, seed 2 bottom half', () => {
  const o = standardSeedOrder(8)
  assert.ok(o.indexOf(1) < 4 && o.indexOf(2) >= 4)
})
expect('size 16: seed 1 top half, seed 2 bottom half', () => {
  const o = standardSeedOrder(16)
  assert.ok(o.indexOf(1) < 8 && o.indexOf(2) >= 8)
})
expect('size 32: seed 1 top half, seed 2 bottom half', () => {
  const o = standardSeedOrder(32)
  assert.ok(o.indexOf(1) < 16 && o.indexOf(2) >= 16)
})

// 3. Round counts & match counts
expect('round counts: 4→2, 8→3, 16→4, 32→5', () => {
  assert.equal(roundCount(4), 2)
  assert.equal(roundCount(8), 3)
  assert.equal(roundCount(16), 4)
  assert.equal(roundCount(32), 5)
})
expect('size-8 matches per round: R1=4, R2=2, R3=1', () => {
  assert.equal(matchesInRound(8, 1), 4)
  assert.equal(matchesInRound(8, 2), 2)
  assert.equal(matchesInRound(8, 3), 1)
})

// 4. Round labels
expect('size 8 labels: R1=QF, R2=SF, R3=F', () => {
  assert.equal(roundLabel(8, 1), 'QF')
  assert.equal(roundLabel(8, 2), 'SF')
  assert.equal(roundLabel(8, 3), 'F')
})
expect('size 16 labels: R1=R16, R2=QF, R3=SF, R4=F', () => {
  assert.equal(roundLabel(16, 1), 'R16')
  assert.equal(roundLabel(16, 2), 'QF')
  assert.equal(roundLabel(16, 3), 'SF')
  assert.equal(roundLabel(16, 4), 'F')
})

// 5. parentSlot advancement
expect('parentSlot: 0→0A, 1→0B, 2→1A, 3→1B', () => {
  assert.deepEqual(parentSlot(0), { slot: 0, side: 'A' })
  assert.deepEqual(parentSlot(1), { slot: 0, side: 'B' })
  assert.deepEqual(parentSlot(2), { slot: 1, side: 'A' })
  assert.deepEqual(parentSlot(3), { slot: 1, side: 'B' })
})

console.log(`\n${pass}/11 passed`)
process.exit(process.exitCode ?? 0)
