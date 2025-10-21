import { spawn } from 'node:child_process'
import { Readable } from 'node:stream'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { ENV } from '@/config/env'

function r2Client(): S3Client {
  const endpoint = `https://${ENV.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: ENV.R2_ACCESS_KEY_ID,
      secretAccessKey: ENV.R2_SECRET_ACCESS_KEY
    }
  })
}

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}_${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}-${pad(d.getUTCSeconds())}Z`
}

async function runPgDumpToFile(outPath: string): Promise<void> {
  const pgDumpPath = ENV.DB_BACKUP_PGDUMP_PATH
  const args = ['--format=custom', '--no-owner', '--no-privileges', '--no-password', '--file', outPath]
  const dbUrl = process.env.DATABASE_URL
  if (dbUrl && dbUrl.trim().length > 0) {
    args.push('--dbname', dbUrl)
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn(pgDumpPath, args, { env: process.env })
    let stderr = ''
    child.stderr.on('data', (d) => { stderr += String(d) })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) return resolve()
      return reject(new Error(`pg_dump exited with code ${code}: ${stderr}`))
    })
  })
}

async function uploadToR2Stream(key: string, body: Readable, contentLength?: number): Promise<void> {
  const client = r2Client()
  await client.send(new PutObjectCommand({
    Bucket: ENV.R2_BACKUP_BUCKET,
    Key: key,
    Body: body,
    ContentType: 'application/octet-stream',
    ...(typeof contentLength === 'number' && contentLength >= 0 ? { ContentLength: contentLength } : {})
  }))
}

async function uploadToR2FromTempFile(key: string, filePath: string): Promise<void> {
  const stat = await fsp.stat(filePath)
  const stream = fs.createReadStream(filePath)
  await uploadToR2Stream(key, stream, stat.size)
}

type ObjectEntry = { key: string; lastModified?: Date }

async function listAllObjects(prefix: string): Promise<ObjectEntry[]> {
  const client = r2Client()
  const results: ObjectEntry[] = []
  let token: string | undefined
  do {
    const resp = await client.send(new ListObjectsV2Command({ Bucket: ENV.R2_BACKUP_BUCKET, Prefix: prefix, ContinuationToken: token }))
    for (const o of resp.Contents || []) {
      if (!o.Key) continue
      results.push({ key: o.Key, lastModified: o.LastModified })
    }
    token = resp.IsTruncated ? resp.NextContinuationToken : undefined
  } while (token)
  return results
}

async function deleteObject(key: string): Promise<void> {
  const client = r2Client()
  await client.send(new DeleteObjectCommand({ Bucket: ENV.R2_BACKUP_BUCKET, Key: key }))
}

function desiredRetentionKeys(now: Date): Set<string> {
  const prefixBase = `${ENV.R2_BACKUP_PREFIX}/`
  const nameFor = (date: Date) => `${prefixBase}backup_${formatDate(date)}.dump`

  const pickDates: Date[] = []

  // теперь/предыдущий (последний и предпоследний бэкап сохраняем отдельно логикой schedule)
  // неделя назад
  const week = new Date(now)
  week.setUTCDate(week.getUTCDate() - 7)
  pickDates.push(week)
  // две недели
  const twoWeeks = new Date(now)
  twoWeeks.setUTCDate(twoWeeks.getUTCDate() - 14)
  pickDates.push(twoWeeks)
  // месяц
  const oneMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, now.getUTCDate()))
  pickDates.push(oneMonth)
  // три месяца
  const threeMonths = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, now.getUTCDate()))
  pickDates.push(threeMonths)
  // шесть месяцев
  const sixMonths = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, now.getUTCDate()))
  pickDates.push(sixMonths)
  // девять месяцев
  const nineMonths = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 9, now.getUTCDate()))
  pickDates.push(nineMonths)
  // год
  const year = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate()))
  pickDates.push(year)

  const keys = new Set<string>(pickDates.map(nameFor))
  return keys
}

function findNearestByDate(objects: ObjectEntry[], targetKey: string): string | null {
  // Match by closest date string within same prefix (ignoring exact time drift)
  const prefix = targetKey.substring(0, targetKey.lastIndexOf('/'))
  const baseName = targetKey.substring(targetKey.lastIndexOf('/') + 1)
  const datePart = baseName.replace(/^backup_/, '').replace(/\.dump$/, '')
  // try to find object with same yyyy-mm or yyyy-mm-dd proximity
  const [ymd] = datePart.split('Z')
  const [ym, _rest] = ymd.split('_')
  const monthPrefix = `${prefix}/backup_${ym}`
  const monthly = objects.filter(o => o.key.startsWith(monthPrefix))
  if (monthly.length === 0) return null
  // pick the one with LastModified closest to the target date (approximate)
  monthly.sort((a, b) => (a.lastModified?.getTime() || 0) - (b.lastModified?.getTime() || 0))
  return monthly[Math.floor(monthly.length / 2)].key
}

async function applyRetention(objects: ObjectEntry[]): Promise<void> {
  const now = new Date()
  const desired = desiredRetentionKeys(now)

  // Always keep latest and previous
  const sorted = [...objects].sort((a, b) => (b.lastModified?.getTime() || 0) - (a.lastModified?.getTime() || 0))
  const keep = new Set<string>()
  if (sorted[0]?.key) keep.add(sorted[0].key)
  if (sorted[1]?.key) keep.add(sorted[1].key)

  // Map desired template keys to nearest available actual keys
  for (const templ of desired) {
    const nearest = findNearestByDate(objects, templ)
    if (nearest) keep.add(nearest)
  }

  // Delete everything else
  const toDelete = objects.map(o => o.key).filter(k => !keep.has(k))
  for (const key of toDelete) {
    await deleteObject(key)
  }
}

export async function runDbBackupOnce(): Promise<void> {
  if (!ENV.DB_BACKUP_ENABLED) return
  // Build object key
  const now = new Date()
  const key = `${ENV.R2_BACKUP_PREFIX}/backup_${formatDate(now)}.dump`
  // Dump to temp file first to have exact Content-Length
  const tmpPath = path.join(os.tmpdir(), `pgdump_${Date.now()}_${Math.random().toString(16).slice(2)}.dump`)
  await runPgDumpToFile(tmpPath)
  try {
    const stat = await fsp.stat(tmpPath)
    if (!stat.size || stat.size <= 0) {
      throw new Error('Empty dump file generated (size 0). Check DATABASE_URL and pg_dump availability.')
    }
    await uploadToR2FromTempFile(key, tmpPath)
  } finally {
    // best-effort cleanup
    try { await fsp.unlink(tmpPath) } catch {}
  }
  // After upload, enforce retention in the same prefix
  const objects = await listAllObjects(`${ENV.R2_BACKUP_PREFIX}/`)
  await applyRetention(objects)
}

export function startDbBackupScheduler(): void {
  if (!ENV.DB_BACKUP_ENABLED) return
  const intervalMs = Math.max(1, ENV.DB_BACKUP_INTERVAL_DAYS) * 24 * 60 * 60 * 1000
  setTimeout(() => { void runDbBackupOnce() }, 10_000)
  setInterval(() => { void runDbBackupOnce() }, intervalMs)
}


