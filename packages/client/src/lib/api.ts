import type { Seat } from '@belot/shared'

export const SERVER_URL =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:3001'

export type RoomListing = {
  code: string
  hostId: string
  seats: Array<{ seat: Seat; nickname: string | null; connected: boolean; isBot: boolean }>
  inGame: boolean
  settings: { gameTo: number; allowSpectators: boolean; enableNT: boolean; enableAT: boolean; turnTimerSec: number; botsFillEmpty: boolean; capotDoubledByContra: boolean }
  spectatorCount: number
}

export async function fetchRooms(): Promise<RoomListing[]> {
  try {
    const r = await fetch(`${SERVER_URL}/rooms`)
    if (!r.ok) return []
    return r.json() as Promise<RoomListing[]>
  } catch {
    return []
  }
}

// Permanently delete the signed-in user's account (server uses the service
// role; the browser can't touch auth.users). Requires the user's own JWT.
export async function deleteAccount(token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(`${SERVER_URL}/account/delete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!r.ok) {
      const body = (await r.json().catch(() => ({}))) as { error?: string }
      return { ok: false, error: body.error ?? `failed: ${r.status}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function createRoom(hostId: string, token?: string): Promise<{ code: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const r = await fetch(`${SERVER_URL}/rooms`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ hostId }),
  })
  if (!r.ok) throw new Error(`create failed: ${r.status}`)
  return r.json()
}
