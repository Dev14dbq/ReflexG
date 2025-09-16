import express from 'express'
import multer, { type StorageEngine } from 'multer'
import path from 'path'
import crypto from 'crypto'
import fs from 'fs'

const router = express.Router()

const CDN_DIR = '/home/deploy/cdn'

// ensure directory exists
try {
  fs.mkdirSync(CDN_DIR, { recursive: true })
} catch {}

const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp'])
const extByMime: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

const storage: StorageEngine = multer.diskStorage({
  destination: (_req: express.Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => cb(null, CDN_DIR),
  filename: (_req: express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const ext = extByMime[file.mimetype] || path.extname(file.originalname) || ''
    const name = `${Date.now()}_${crypto.randomUUID()}${ext}`
    cb(null, name)
  }
})

const upload = multer({
  storage,
  // без лимитов на размер — сжатие выполняется на клиенте
  fileFilter: (_req: express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (!allowedMime.has(file.mimetype)) return cb(new Error('Unsupported file type'))
    cb(null, true)
  }
})

function sha256FileSync(filePath: string): string {
  const hash = crypto.createHash('sha256')
  const data = fs.readFileSync(filePath)
  hash.update(data)
  return hash.digest('hex')
}

router.post('/cdn/upload', upload.single('file'), (req: express.Request, res: express.Response) => {
  const file = (req as unknown as { file?: Express.Multer.File }).file
  if (!file) return res.status(400).json({ ok: false, message: 'No file' })

  try {
    const ext = extByMime[file.mimetype] || path.extname(file.originalname) || ''
    const tmpPath = file.path
    const digest = sha256FileSync(tmpPath)
    const targetName = `${digest}${ext}`
    const targetPath = path.join(CDN_DIR, targetName)
    if (fs.existsSync(targetPath)) {
      // Дубликат — удаляем временный файл, возвращаем существующий
      try { fs.unlinkSync(tmpPath) } catch {}
      return res.json({ ok: true, filename: targetName })
    }
    // Переименуем в хеш-имя
    fs.renameSync(tmpPath, targetPath)
    return res.json({ ok: true, filename: targetName })
  } catch (e) {
    // попытка очистить временный файл на случай исключения
    const tmp = (req as any)?.file?.path as string | undefined
    if (tmp) { try { fs.unlinkSync(tmp) } catch {} }
    return res.status(500).json({ ok: false, message: 'Upload failed' })
  }
})

export const cdnRouter = router


