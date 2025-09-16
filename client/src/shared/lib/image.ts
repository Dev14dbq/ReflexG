export async function compressImageToJpeg(file: File, maxSizePx = 1080, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap
  const scale = Math.min(1, maxSizePx / Math.max(width, height))
  const targetW = Math.max(1, Math.round(width * scale))
  const targetH = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, targetW, targetH)
  const blob: Blob = await new Promise((resolve) => canvas.toBlob(b => resolve(b as Blob), 'image/jpeg', quality))
  return blob
}


