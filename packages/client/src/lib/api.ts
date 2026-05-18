export const SERVER_URL =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:3001'

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
