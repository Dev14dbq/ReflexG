import { requireEnvUrl } from '@/shared/config/env'

export interface UnreadLikesResponse {
  ok: true
  count: number
}

export async function fetchUnreadLikesCount(initData: string): Promise<UnreadLikesResponse> {
  const base = requireEnvUrl('API_URL')
  const url = new URL('likes/unread-count', base)
  url.searchParams.set('initData', initData)
  
  const resp = await fetch(url.toString())
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (!data || !data.ok) throw new Error('Bad response')
  return data as UnreadLikesResponse
}
