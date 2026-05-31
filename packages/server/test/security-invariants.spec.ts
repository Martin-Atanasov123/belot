import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

// B1 regression guard. Results are server-authoritative (the game server writes
// them with the service_role key; clients are read-only). These tests fail if
// that invariant is ever silently reintroduced from the client side or weakened
// in the hardening migration. See CLAUDE.md and 20260521_security_hardening.sql.

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..')
const clientSrc = join(repoRoot, 'packages', 'client', 'src')
const migration = join(repoRoot, 'supabase', 'migrations', '20260521_security_hardening.sql')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.tsx?$/.test(full)) out.push(full)
  }
  return out
}

// supabase-js write verbs that mutate a table.
const WRITE_VERB = String.raw`\.(insert|upsert|update|delete)\s*\(`

describe('B1: results stay server-authoritative', () => {
  const clientFiles = (() => {
    // Fail loudly rather than silently passing if the path moves.
    expect(existsSync(clientSrc), `client source not found at ${clientSrc}`).toBe(true)
    return walk(clientSrc).map((f) => ({ path: f, body: readFileSync(f, 'utf8') }))
  })()

  it('client never writes the matches / match_events tables', () => {
    // A write is from('matches'|'match_events') followed by a write verb within
    // the same chained statement. SELECT-only access (stats, leaderboard) is fine.
    const re = new RegExp(
      String.raw`from\(\s*['"](?:matches|match_events)['"]\s*\)[\s\S]{0,300}?` + WRITE_VERB,
      'g',
    )
    const offenders = clientFiles
      .filter((f) => re.test(f.body))
      .map((f) => relative(repoRoot, f.path))
    expect(
      offenders,
      `client must be read-only on matches/match_events; offending files:\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  it('client never sets winner_id on tournament_matches', () => {
    // Clients may update room_code/status (the play-match flow) but winner_id is
    // server-only (guarded by guard_tmatch_winner). Flag any update payload that
    // mentions winner_id on a tournament_matches chain.
    const re = new RegExp(
      String.raw`from\(\s*['"]tournament_matches['"]\s*\)[\s\S]{0,400}?\.update\(([\s\S]{0,400}?)\)`,
      'g',
    )
    const offenders: string[] = []
    for (const f of clientFiles) {
      for (const m of f.body.matchAll(re)) {
        if (m[1].includes('winner_id')) offenders.push(relative(repoRoot, f.path))
      }
    }
    expect(
      offenders,
      `winner_id is server-only; offending files:\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})

describe('B1: hardening migration keeps its invariants', () => {
  it('exists and still revokes client writes + guards winner_id', () => {
    expect(existsSync(migration), `missing ${migration}`).toBe(true)
    const sql = readFileSync(migration, 'utf8').toLowerCase().replace(/\s+/g, ' ')
    expect(sql).toContain('drop table if exists public.test_demo')
    expect(sql).toContain('revoke insert on public.matches from authenticated')
    expect(sql).toContain('revoke insert on public.match_events from authenticated')
    expect(sql).toContain('create trigger guard_tmatch_winner')
  })
})
