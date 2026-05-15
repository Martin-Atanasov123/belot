import { describe, expect, it } from 'vitest'
import { applyBid, bidLegal, startBidding } from '../src/bidding.js'
import type { Seat } from '@belot/shared'

const enable = { enableNT: true, enableAT: true }

describe('bidding', () => {
  it('starts with first bidder = dealer+1', () => {
    const b = startBidding(3)
    expect(b.turn).toBe(0)
    expect(b.history).toEqual([])
  })

  it('records a winning bid after 3 consecutive passes', () => {
    let b = startBidding(3)
    b = applyBid(b, 0, { type: 'BID', contract: 'H' })
    b = applyBid(b, 1, { type: 'PASS' })
    b = applyBid(b, 2, { type: 'PASS' })
    b = applyBid(b, 3, { type: 'PASS' })
    expect(b.done).toBe(true)
    expect(b.result?.contract).toBe('H')
    expect(b.result?.bidder).toBe(0)
    expect(b.result?.trump).toBe('H')
    expect(b.result?.multiplier).toBe(1)
  })

  it('redeals after 4 passes with no bid', () => {
    let b = startBidding(3)
    for (let i = 0; i < 4; i++) b = applyBid(b, ((i + 0) % 4) as Seat, { type: 'PASS' })
    expect(b.done).toBe(true)
    expect(b.redeal).toBe(true)
    expect(b.result).toBeNull()
  })

  it('requires each bid to outrank the previous', () => {
    let b = startBidding(3)
    b = applyBid(b, 0, { type: 'BID', contract: 'H' })
    expect(bidLegal(b, 1, { type: 'BID', contract: 'C' }, enable)).toMatch(/higher/)
    expect(bidLegal(b, 1, { type: 'BID', contract: 'S' }, enable)).toBeNull()
  })

  it('AT outranks NT outranks S outranks H outranks D outranks C', () => {
    let b = startBidding(3)
    b = applyBid(b, 0, { type: 'BID', contract: 'C' })
    b = applyBid(b, 1, { type: 'BID', contract: 'D' })
    b = applyBid(b, 2, { type: 'BID', contract: 'H' })
    b = applyBid(b, 3, { type: 'BID', contract: 'S' })
    b = applyBid(b, 0, { type: 'BID', contract: 'NT' })
    b = applyBid(b, 1, { type: 'BID', contract: 'AT' })
    expect(b.currentBid?.contract).toBe('AT')
  })

  it('contra/re-contra rules', () => {
    // Sequence designed to land each contra/re-contra on the correct seat's turn.
    let b = startBidding(3)
    b = applyBid(b, 0, { type: 'BID', contract: 'H' }) // NS bids, turn → 1
    b = applyBid(b, 1, { type: 'PASS' })                // turn → 2
    // Seat 2 is NS (bidder team) — cannot contra own team.
    expect(bidLegal(b, 2, { type: 'CONTRA' }, enable)).toMatch(/own team/)
    b = applyBid(b, 2, { type: 'PASS' })                // turn → 3
    b = applyBid(b, 3, { type: 'CONTRA' })              // EW contras, turn → 0
    expect(b.multiplier).toBe(2)
    // After contra: same-team-can't-recontra, only bidder team
    expect(bidLegal(b, 0, { type: 'CONTRA' }, enable)).toMatch(/already/)
    b = applyBid(b, 0, { type: 'RECONTRA' })            // NS re-contras, turn → 1
    expect(b.multiplier).toBe(4)
    // Three passes terminate
    b = applyBid(b, 1, { type: 'PASS' })
    b = applyBid(b, 2, { type: 'PASS' })
    b = applyBid(b, 3, { type: 'PASS' })
    expect(b.done).toBe(true)
    expect(b.result?.multiplier).toBe(4)
  })

  it('NT can be disabled by settings', () => {
    const b = startBidding(3)
    expect(bidLegal(b, 0, { type: 'BID', contract: 'NT' }, { enableNT: false, enableAT: true })).toMatch(/NT/)
  })

  it('rejects acting out of turn', () => {
    const b = startBidding(3)
    expect(bidLegal(b, 1, { type: 'PASS' }, enable)).toMatch(/turn/)
  })
})
