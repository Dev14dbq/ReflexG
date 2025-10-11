import { requireEnvUrl } from '@/shared/config/env'

export interface settingsThemeResponse {
    ok: true
    settings: {
        userId: string,
        pinned: object,
        archive: object,
        topic: string
    }
}

export async function fetchThemeSettings(initData: string,): Promise<settingsThemeResponse> {
    const base = requireEnvUrl('API_URL')
    const url = new URL('settings/theme', base)
  
    url.searchParams.set('initData', initData)
  
    const resp = await fetch(url.toString())
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    if (!data || !data.ok) throw new Error('Bad response')
    return data as settingsThemeResponse
}
  