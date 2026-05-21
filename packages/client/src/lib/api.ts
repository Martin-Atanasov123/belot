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
