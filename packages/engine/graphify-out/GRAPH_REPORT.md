# Graph Report - packages\engine  (2026-05-26)

## Corpus Check
- 20 files · ~13,513 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 164 nodes · 311 edges · 11 communities (10 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7a6817a7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 10|Community 10]]

## God Nodes (most connected - your core abstractions)
1. `applyBidPhase()` - 10 edges
2. `scanHand()` - 9 edges
3. `resolveAnnouncements()` - 8 edges
4. `startNewHand()` - 8 edges
5. `shuffledDeck()` - 7 edges
6. `legalMoves()` - 7 edges
7. `isTrump()` - 7 edges
8. `scripts` - 6 edges
9. `currentTrickWinnerIndex()` - 6 edges
10. `trickWinner()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `seatHand()` --calls--> `scanHand()`  [EXTRACTED]
  test/coverage-gaps.spec.ts → src/announcements.ts
- `seatHand()` --calls--> `scanHand()`  [EXTRACTED]
  test/announcements.spec.ts → src/announcements.ts
- `play()` --calls--> `apply()`  [EXTRACTED]
  test/match.spec.ts → src/match.ts
- `settle()` --calls--> `resolveTrick()`  [EXTRACTED]
  test/match.spec.ts → src/match.ts
- `play()` --calls--> `isError()`  [EXTRACTED]
  test/match.spec.ts → src/match.ts

## Communities (11 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (23): applyBid(), BiddingState, BidInput, bidLegal(), startBidding(), advanceHand(), apply(), applyBidPhase() (+15 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (22): bestOf(), CARRE_POINTS, CarreCandidate, collectTeam(), compareSequence(), findCarresInHand(), findSequencesInHand(), resolveAnnouncements() (+14 more)

### Community 2 - "Community 2"
Cohesion: 0.17
Nodes (18): autoPickOnTimeout(), hasPendingTrick(), isError(), newMatch(), adv, autoBidToAT(), card, legal (+10 more)

### Community 3 - "Community 3"
Cohesion: 0.13
Nodes (15): basePointsForContract(), cardPoints(), PLAIN_POINTS, PLAIN_STRENGTH, PLAIN_SUIT_ORDER, SEQUENCE_RANK_ORDER, sortHandForDisplay(), suitDisplayOrder() (+7 more)

### Community 4 - "Community 4"
Cohesion: 0.23
Nodes (14): buildDeck(), dealFirstFive(), dealFromSeed(), dealHands(), dealLastThree(), distribute(), shuffledDeck(), Rng (+6 more)

### Community 5 - "Community 5"
Cohesion: 0.24
Nodes (13): currentTrickWinnerIndex(), currentWinningStrength(), isLegalPlay(), isPartnerCurrentlyWinning(), legalMoves(), trickHasTrump(), trickWinner(), applyPlayPhase() (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (14): dependencies, @belot/shared, exports, main, name, scripts, build, test (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.17
Nodes (11): holdsBelotPair(), projectView(), reconstructDealHand(), b, enable, perSeat, r, seatHand() (+3 more)

### Community 8 - "Community 8"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, paths, rootDir, extends, include, @belot/shared

## Knowledge Gaps
- **74 isolated node(s):** `name`, `version`, `type`, `main`, `types` (+69 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `scanHand()` connect `Community 1` to `Community 0`, `Community 7`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `resolveAnnouncements()` connect `Community 1` to `Community 0`, `Community 7`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `mulberry32()` connect `Community 0` to `Community 4`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `name`, `version`, `type` to the rest of the system?**
  _74 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.12643678160919541 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.13071895424836602 - nodes in this community are weakly interconnected._