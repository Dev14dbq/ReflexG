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

export async function cropImageTo9x16(file: File, quality = 0.9): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap
  
  // Определяем размеры для обрезания под 9:16
  const aspectRatio = 9 / 16
  let cropWidth = width
  let cropHeight = height
  let offsetX = 0
  let offsetY = 0
  
  // Если изображение шире чем нужно для 9:16
  if (width / height > aspectRatio) {
    cropHeight = height
    cropWidth = Math.round(height * aspectRatio)
    offsetX = Math.round((width - cropWidth) / 2)
  } else {
    // Если изображение выше чем нужно для 9:16
    cropWidth = width
    cropHeight = Math.round(width / aspectRatio)
    offsetY = Math.round((height - cropHeight) / 2)
  }
  
  // Определяем финальный размер (HD = 720p по меньшей стороне)
  const hdSize = 720
  const finalWidth = Math.round(cropWidth * (hdSize / Math.min(cropWidth, cropHeight)))
  const finalHeight = Math.round(cropHeight * (hdSize / Math.min(cropWidth, cropHeight)))
  
  const canvas = document.createElement('canvas')
  canvas.width = finalWidth
  canvas.height = finalHeight
  const ctx = canvas.getContext('2d')!
  
  // Обрезаем и масштабируем изображение
  ctx.drawImage(
    bitmap,
    offsetX, offsetY, cropWidth, cropHeight, // источник
    0, 0, finalWidth, finalHeight // назначение
  )
  
  const blob: Blob = await new Promise((resolve) => 
    canvas.toBlob(b => resolve(b as Blob), 'image/jpeg', quality)
  )
  return blob
}


