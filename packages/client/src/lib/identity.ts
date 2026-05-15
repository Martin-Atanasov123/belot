// playerId is paired with the chosen nickname so refreshing the same tab reconnects
// to your seat, but two tabs in the same browser using different nicknames are treated
// as two different players (which is what you want for solo testing).
const NICK_KEY = 'belot.nickname'
const MAP_KEY = 'belot.playerIdByNick' // JSON map: { [nickname]: playerId }

function readMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(MAP_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function writeMap(m: Record<string, string>) {
  localStorage.setItem(MAP_KEY, JSON.stringify(m))
}

export function getPlayerIdFor(nickname: string): string {
  const key = nickname.trim().toLowerCase()
  const map = readMap()
  if (!map[key]) {
    map[key] = crypto.randomUUID()
    writeMap(map)
  }
  return map[key]!
}

export function getNickname(): string {
  return localStorage.getItem(NICK_KEY) ?? ''
}

export function setNickname(n: string) {
  localStorage.setItem(NICK_KEY, n)
}
