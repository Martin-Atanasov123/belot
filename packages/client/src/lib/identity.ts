// A stable per-browser playerId, kept in localStorage so a refresh reconnects.
const KEY = 'belot.playerId'
const NICK_KEY = 'belot.nickname'

export function getPlayerId(): string {
  let v = localStorage.getItem(KEY)
  if (!v) {
    v = crypto.randomUUID()
    localStorage.setItem(KEY, v)
  }
  return v
}

export function getNickname(): string {
  return localStorage.getItem(NICK_KEY) ?? ''
}

export function setNickname(n: string) {
  localStorage.setItem(NICK_KEY, n)
}
