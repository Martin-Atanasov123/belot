import { describe, expect, it } from 'vitest'
import { isMatchOver } from '../src/match.js'

// "С капо не се излиза" — Bulgarian belot rule preventing a team from winning
// the match purely on the +90 capot bonus. These tests pin down `isMatchOver`
// (the pure helper that match.ts uses to decide GAME_OVER vs HAND_OVER).
describe('С капо не се излиза', () => {
  it('normal win (no capot involved) ends the match', () => {
    expect(isMatchOver({ NS: 156, EW: 130 }, null, 1, true, 151)).toBe(true)
  })

  it('win with capot — but team would still be over without it → match ends', () => {
    // NS 165 with capot of 9 tens; without capot 156 — still ≥ 151.
    expect(isMatchOver({ NS: 165, EW: 130 }, 'NS', 1, true, 151)).toBe(true)
  })

  it('"С капо не се излиза": capot alone pushed them over → keep playing', () => {
    // NS reached 154 (3 tens over the line). Subtract the 9-ten capot → 145
    // — under target. Match must continue.
    expect(isMatchOver({ NS: 154, EW: 130 }, 'NS', 1, true, 151)).toBe(false)
  })

  it('capot is doubled by contra → still applies', () => {
    // ×2 multiplier with capotDoubledByContra=true means the capot contributes
    // 18 tens. NS 163 - 18 = 145 < 151 → keep playing.
    expect(isMatchOver({ NS: 163, EW: 100 }, 'NS', 2, true, 151)).toBe(false)
  })

  it('capot NOT doubled by contra → only 9 tens are subtracted', () => {
    // Same ×2 multiplier, but the variant where capot stays fixed at 9 tens.
    // NS 163 - 9 = 154 ≥ 151 → match ends.
    expect(isMatchOver({ NS: 163, EW: 100 }, 'NS', 2, false, 151)).toBe(true)
  })

  it('the capot belonged to the LOSER → does not protect the leader', () => {
    // If the opponents got the capot but the leader still crossed, the rule
    // does not apply to the leader — they did it without the capot.
    expect(isMatchOver({ NS: 158, EW: 130 }, 'EW', 1, true, 151)).toBe(true)
  })

  it('tie at target → match continues', () => {
    expect(isMatchOver({ NS: 151, EW: 151 }, null, 1, true, 151)).toBe(false)
  })

  it('neither team reached target → match continues', () => {
    expect(isMatchOver({ NS: 100, EW: 90 }, 'NS', 1, true, 151)).toBe(false)
  })

  it('respects a 101-tens variant', () => {
    expect(isMatchOver({ NS: 105, EW: 80 }, null, 1, true, 101)).toBe(true)
    expect(isMatchOver({ NS: 103, EW: 80 }, 'NS', 1, true, 101)).toBe(false) // 103-9=94 < 101
  })
})
