import express from 'express'
import multer from 'multer'
import crypto from 'crypto'
import { ENV } from '@/config/env'
import { prisma } from '@/lib/prisma'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

// GET Cloudflare Transformations settings
router.get('/cdn/transformations', async (_req: express.Request, res: express.Response) => {
  try {
    if (!ENV.CLOUDFLARE_API_TOKEN || !ENV.CLOUDFLARE_ZONE_ID) {
      return res.status(500).json({ ok: false, message: 'Cloudflare is not configured' })
    }
    const url = `https://api.cloudflare.com/client/v4/zones/${ENV.CLOUDFLARE_ZONE_ID}/settings/transformations`
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ENV.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    const json = await resp.json()
    res.status(resp.status).json(json)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[CDN] GET transformations error:', e)
    res.status(500).json({ ok: false, message: 'Failed to fetch Cloudflare transformations' })
  }
})

// PATCH Cloudflare Transformations settings
router.patch('/cdn/transformations', async (req: express.Request, res: express.Response) => {
  try {
    if (!ENV.CLOUDFLARE_API_TOKEN || !ENV.CLOUDFLARE_ZONE_ID) {
      return res.status(500).json({ ok: false, message: 'Cloudflare is not configured' })
    }
    const { value } = req.body as { value?: 'on' | 'off' }
    if (value !== 'on' && value !== 'off') {
      return res.status(400).json({ ok: false, message: "Body must include { value: 'on' | 'off' }" })
    }
    const url = `https://api.cloudflare.com/client/v4/zones/${ENV.CLOUDFLARE_ZONE_ID}/settings/transformations`
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${ENV.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    })
    const json = await resp.json()
    res.status(resp.status).json(json)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[CDN] PATCH transformations error:', e)
    res.status(500).json({ ok: false, message: 'Failed to update Cloudflare transformations' })
  }
})

export const cdnRouter = router


// =============================
// Cloudflare Images integrations
// =============================

// Create Direct Upload URL (V2)
router.post('/cdn/images/direct-upload', async (_req: express.Request, res: express.Response) => {
  try {
    if (!ENV.CLOUDFLARE_API_TOKEN || !ENV.CLOUDFLARE_ACCOUNT_ID) {
      // eslint-disable-next-line no-console
      console.error('[CDN] Missing configuration', {
        hasToken: Boolean(ENV.CLOUDFLARE_API_TOKEN),
        hasAccountId: Boolean(ENV.CLOUDFLARE_ACCOUNT_ID)
      })
      return res.status(500).json({ ok: false, message: 'Cloudflare Images is not configured' })
    }
    const url = `https://api.cloudflare.com/client/v4/accounts/${ENV.CLOUDFLARE_ACCOUNT_ID}/images/v2/direct_upload`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ENV.CLOUDFLARE_API_TOKEN}`
      }
      // No body and no Content-Type header per CF Images v2 direct_upload requirements
    })
    const text = await resp.text()
    let json: any = {}
    try { json = JSON.parse(text) } catch {}
    if (!resp.ok || !json?.result?.uploadURL || !json?.result?.id) {
      // eslint-disable-next-line no-console
      console.error('[CDN] Direct upload failed', { status: resp.status, body: text })
      return res.status(resp.status || 500).json({ ok: false, message: 'Failed to create direct upload URL', details: json?.errors || json || text })
    }
    return res.json({ ok: true, id: json.result.id as string, uploadURL: json.result.uploadURL as string })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[CDN] direct upload error:', e)
    res.status(500).json({ ok: false, message: 'Failed to create direct upload URL' })
  }
})

// Upload image via backend (server-to-CDN)
router.post('/cdn/images/upload', upload.single('file'), async (req: express.Request, res: express.Response) => {
  try {
    if (!ENV.CLOUDFLARE_API_TOKEN || !ENV.CLOUDFLARE_ACCOUNT_ID) {
      // eslint-disable-next-line no-console
      console.error('[CDN] Missing configuration', {
        hasToken: Boolean(ENV.CLOUDFLARE_API_TOKEN),
        hasAccountId: Boolean(ENV.CLOUDFLARE_ACCOUNT_ID)
      })
      return res.status(500).json({ ok: false, message: 'Cloudflare Images is not configured' })
    }

    const file = (req as unknown as { file?: Express.Multer.File }).file
    if (!file) return res.status(400).json({ ok: false, message: 'No file' })

    // Compute deterministic short hash (first 16 hex chars of sha256) to use as Cloudflare image id
    const sha = crypto.createHash('sha256').update(file.buffer).digest('hex')
    const contentHash = sha.slice(0, 16)

    // Optional DB-level dedup: if a photo with same id exists anywhere, short-circuit
    try {
      const dup = await prisma.photo.findFirst({ where: { url: contentHash } })
      if (dup) {
        return res.json({ ok: true, id: contentHash, deduped: true })
      }
    } catch {}

    const form = new FormData()
    const blob = new Blob([file.buffer], { type: file.mimetype || 'image/avif' })
    // Hint filename; CF uses `id` as primary identifier
    form.append('file', blob, file.originalname || `${contentHash}`)
    // Set Cloudflare Image ID to deterministic hash for cross-user dedup/reference
    form.append('id', contentHash)
    // Attach metadata for traceability
    const meta = {
      source: 'GetinginOkeanoSpectr',
      contentHash,
      size: file.size,
      mimeType: file.mimetype || 'image/avif'
    }
    form.append('metadata', JSON.stringify(meta))

    const url = `https://api.cloudflare.com/client/v4/accounts/${ENV.CLOUDFLARE_ACCOUNT_ID}/images/v1`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ENV.CLOUDFLARE_API_TOKEN}`
      },
      body: form
    })
    const text = await resp.text()
    let json: any = {}
    try { json = JSON.parse(text) } catch {}
    if (!resp.ok || !json?.result?.id) {
      // eslint-disable-next-line no-console
      console.error('[CDN] Upload failed', { status: resp.status, body: text })
      return res.status(resp.status || 500).json({ ok: false, message: 'Failed to upload image', details: json?.errors || json || text })
    }
    const id: string = json.result.id
    // Return only image id; client will compose variant delivery URL
    return res.json({ ok: true, id })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[CDN] server upload error:', e)
    res.status(500).json({ ok: false, message: 'Failed to upload image' })
  }
})

// Get Image Details (V1)
router.get('/cdn/images/:id', async (req: express.Request, res: express.Response) => {
  try {
    if (!ENV.CLOUDFLARE_API_TOKEN || !ENV.CLOUDFLARE_ACCOUNT_ID) {
      // eslint-disable-next-line no-console
      console.error('[CDN] Missing configuration', {
        hasToken: Boolean(ENV.CLOUDFLARE_API_TOKEN),
        hasAccountId: Boolean(ENV.CLOUDFLARE_ACCOUNT_ID)
      })
      return res.status(500).json({ ok: false, message: 'Cloudflare Images is not configured' })
    }
    const { id } = req.params
    const url = `https://api.cloudflare.com/client/v4/accounts/${ENV.CLOUDFLARE_ACCOUNT_ID}/images/v1/${encodeURIComponent(id)}`
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ENV.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    const text = await resp.text()
    let json: any = {}
    try { json = JSON.parse(text) } catch {}
    if (!resp.ok || !json?.result) {
      // eslint-disable-next-line no-console
      console.error('[CDN] Get details failed', { status: resp.status, body: text })
      return res.status(resp.status || 500).json({ ok: false, message: 'Failed to get image details', details: json?.errors || json || text })
    }
    const r = json.result
    return res.json({ ok: true, id: r.id, filename: r.filename, variants: r.variants || [] })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[CDN] get image error:', e)
    res.status(500).json({ ok: false, message: 'Failed to get image details' })
  }
})

// List Images (V2)
router.get('/cdn/images', async (req: express.Request, res: express.Response) => {
  try {
    if (!ENV.CLOUDFLARE_API_TOKEN || !ENV.CLOUDFLARE_ACCOUNT_ID) {
      // eslint-disable-next-line no-console
      console.error('[CDN] Missing configuration', {
        hasToken: Boolean(ENV.CLOUDFLARE_API_TOKEN),
        hasAccountId: Boolean(ENV.CLOUDFLARE_ACCOUNT_ID)
      })
      return res.status(500).json({ ok: false, message: 'Cloudflare Images is not configured' })
    }
    const { continuation_token, per_page } = req.query
    const qs = new URLSearchParams()
    if (typeof continuation_token === 'string') qs.set('continuation_token', continuation_token)
    if (typeof per_page === 'string') qs.set('per_page', per_page)
    const url = `https://api.cloudflare.com/client/v4/accounts/${ENV.CLOUDFLARE_ACCOUNT_ID}/images/v2${qs.toString() ? `?${qs.toString()}` : ''}`
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ENV.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    const text = await resp.text()
    let json: any = {}
    try { json = JSON.parse(text) } catch {}
    if (!resp.ok || !json?.result) {
      // eslint-disable-next-line no-console
      console.error('[CDN] List failed', { status: resp.status, body: text })
      return res.status(resp.status || 500).json({ ok: false, message: 'Failed to list images', details: json?.errors || json || text })
    }
    return res.json({ ok: true, ...json.result })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[CDN] list images error:', e)
    res.status(500).json({ ok: false, message: 'Failed to list images' })
  }
})

// Delete Image (V1)
router.delete('/cdn/images/:id', async (req: express.Request, res: express.Response) => {
  try {
    if (!ENV.CLOUDFLARE_API_TOKEN || !ENV.CLOUDFLARE_ACCOUNT_ID) {
      // eslint-disable-next-line no-console
      console.error('[CDN] Missing configuration', {
        hasToken: Boolean(ENV.CLOUDFLARE_API_TOKEN),
        hasAccountId: Boolean(ENV.CLOUDFLARE_ACCOUNT_ID)
      })
      return res.status(500).json({ ok: false, message: 'Cloudflare Images is not configured' })
    }
    const { id } = req.params
    const url = `https://api.cloudflare.com/client/v4/accounts/${ENV.CLOUDFLARE_ACCOUNT_ID}/images/v1/${encodeURIComponent(id)}`
    const resp = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${ENV.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    const text = await resp.text()
    let json: any = {}
    try { json = JSON.parse(text) } catch {}
    if (!resp.ok) {
      // eslint-disable-next-line no-console
      console.error('[CDN] Delete failed', { status: resp.status, body: text })
      return res.status(resp.status || 500).json({ ok: false, message: 'Failed to delete image', details: json?.errors || json || text })
    }
    return res.json({ ok: true })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[CDN] delete image error:', e)
    res.status(500).json({ ok: false, message: 'Failed to delete image' })
  }
})

// Update Image (V1) - access control / metadata
router.patch('/cdn/images/:id', async (req: express.Request, res: express.Response) => {
  try {
    if (!ENV.CLOUDFLARE_API_TOKEN || !ENV.CLOUDFLARE_ACCOUNT_ID) {
      // eslint-disable-next-line no-console
      console.error('[CDN] Missing configuration', {
        hasToken: Boolean(ENV.CLOUDFLARE_API_TOKEN),
        hasAccountId: Boolean(ENV.CLOUDFLARE_ACCOUNT_ID)
      })
      return res.status(500).json({ ok: false, message: 'Cloudflare Images is not configured' })
    }

    const { id } = req.params
    // Allow only selected fields to be forwarded
    const { requireSignedURLs, metadata, creator } = req.body as { requireSignedURLs?: boolean; metadata?: unknown; creator?: string }
    const payload: Record<string, unknown> = {}
    if (typeof requireSignedURLs === 'boolean') payload.requireSignedURLs = requireSignedURLs
    if (typeof creator === 'string') payload.creator = creator
    if (typeof metadata !== 'undefined') payload.metadata = metadata

    const url = `https://api.cloudflare.com/client/v4/accounts/${ENV.CLOUDFLARE_ACCOUNT_ID}/images/v1/${encodeURIComponent(id)}`
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${ENV.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    const text = await resp.text()
    let json: any = {}
    try { json = JSON.parse(text) } catch {}
    if (!resp.ok || !json?.result) {
      // eslint-disable-next-line no-console
      console.error('[CDN] Patch image failed', { status: resp.status, body: text })
      return res.status(resp.status || 500).json({ ok: false, message: 'Failed to patch image', details: json?.errors || json || text })
    }
    return res.json({ ok: true, result: json.result })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[CDN] patch image error:', e)
    res.status(500).json({ ok: false, message: 'Failed to patch image' })
  }
})

