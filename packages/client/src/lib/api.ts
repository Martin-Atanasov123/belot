export const SERVER_URL =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:3001'

export async function createRoom(hostId: string): Promise<{ code: string }> {
  const r = await fetch(`${SERVER_URL}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostId }),
  })
  if (!r.ok) throw new Error(`create failed: ${r.status}`)
  return r.json()
}
