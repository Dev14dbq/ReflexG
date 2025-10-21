import { prisma } from '@/lib/prisma'
import { ENV } from '@/config/env'

type CloudflareImage = { id: string; filename?: string; uploaded?: string }

async function listCloudflareImages(continuation?: string): Promise<{ images: CloudflareImage[]; continuation?: string }> {
  if (!ENV.CLOUDFLARE_API_TOKEN || !ENV.CLOUDFLARE_ACCOUNT_ID) return { images: [] }
  const qs = new URLSearchParams()
  if (continuation) qs.set('continuation_token', continuation)
  const url = `https://api.cloudflare.com/client/v4/accounts/${ENV.CLOUDFLARE_ACCOUNT_ID}/images/v2${qs.toString() ? `?${qs.toString()}` : ''}`
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ENV.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  })
  const json = await resp.json().catch(() => ({})) as any
  const images: CloudflareImage[] = Array.isArray(json?.result?.images)
    ? json.result.images.map((it: any) => ({ id: String(it?.id || ''), filename: it?.filename, uploaded: it?.uploaded }))
    : []
  const token: string | undefined = json?.result?.continuation_token || undefined
  return { images, continuation: token }
}

async function deleteCloudflareImageById(id: string): Promise<void> {
  try {
    if (!ENV.CLOUDFLARE_API_TOKEN || !ENV.CLOUDFLARE_ACCOUNT_ID) return
    const url = `https://api.cloudflare.com/client/v4/accounts/${ENV.CLOUDFLARE_ACCOUNT_ID}/images/v1/${encodeURIComponent(id)}`
    await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${ENV.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[CF GC] Failed to delete image', id, e)
  }
}

export function startCloudflareImagesGc(): void {
  if (!ENV.CF_IMAGES_GC_ENABLED) return
  let timer: NodeJS.Timeout | null = null

  const runOnce = async () => {
    try {
      const graceDays = Math.max(0, ENV.CF_IMAGES_GC_GRACE_DAYS)
      const graceCutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000)

      // Build a set of referenced IDs from DB
      const referenced = new Set<string>()
      // Profile photos
      const photos = await prisma.photo.findMany({ select: { url: true } })
      for (const p of photos) if (p.url) referenced.add(p.url)
      // Chat message images (only non-deleted)
      const imagesInMessages = await prisma.message.findMany({
        where: { deletedAt: null, photoUrl: { not: null } },
        select: { photoUrl: true }
      })
      for (const m of imagesInMessages) if (m.photoUrl) referenced.add(m.photoUrl)
      // Sticker images (only non-deleted messages)
      const stickerImages = await prisma.message.findMany({
        where: { deletedAt: null, stickerId: { not: null } },
        include: { sticker: { select: { imageUrl: true } } }
      })
      for (const m of stickerImages) if ((m as any).sticker?.imageUrl) referenced.add((m as any).sticker.imageUrl)
      // Sticker pack thumbnails
      const packThumbnails = await prisma.stickerPack.findMany({
        where: { thumbnail: { not: null } },
        select: { thumbnail: true }
      })
      for (const p of packThumbnails) if (p.thumbnail) referenced.add(p.thumbnail)
      // Attachments referencing CF Images ids (if used)
      const attachments = await prisma.messageAttachment.findMany({ select: { url: true } })
      for (const a of attachments) if (a.url) referenced.add(a.url)

      // Optionally include user custom avatar if stored as CF Images id in the future
      // Currently customPhotoUrl may be a full URL; we only match exact ids in Photo.url

      // Iterate over CF images with pagination
      let cont: string | undefined = undefined
      let checked = 0
      let removed = 0
      do {
        const { images, continuation } = await listCloudflareImages(cont)
        cont = continuation
        for (const img of images) {
          if (!img.id) continue
          checked++
          if (referenced.has(img.id)) continue
          // Respect grace period if uploaded timestamp exists
          if (img.uploaded) {
            const uploadedAt = new Date(img.uploaded)
            if (uploadedAt > graceCutoff) continue
          }
          // Delete orphan
          await deleteCloudflareImageById(img.id)
          removed++
        }
      } while (cont)
      // eslint-disable-next-line no-console
      console.log(`[CF GC] Completed. Checked=${checked}, removed=${removed}`)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[CF GC] Error during run', e)
    }
  }

  const schedule = () => {
    const intervalMs = Math.max(1, ENV.CF_IMAGES_GC_INTERVAL_MIN) * 60 * 1000
    timer = setInterval(runOnce, intervalMs)
  }

  // Kickoff after startup delay to avoid cold start spikes
  setTimeout(() => {
    void runOnce()
    schedule()
  }, 15_000)
}


