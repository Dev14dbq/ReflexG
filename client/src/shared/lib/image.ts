export async function compressImageToAvif(file: File, maxSizePx = 1080, quality = 0.8): Promise<Blob> {
  try {
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
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(b => {
        if (b) resolve(b as Blob)
        else reject(new Error('Failed to convert to AVIF'))
      }, 'image/avif', quality)
    })
    return blob
  } catch (error) {
    console.error('Failed to compress image:', error)
    throw new Error(`Не удалось обработать изображение: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
  }
}

export async function cropImageTo9x16Avif(file: File, quality = 0.9): Promise<Blob> {
  try {
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
    
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(b => {
        if (b) resolve(b as Blob)
        else reject(new Error('Failed to convert to AVIF'))
      }, 'image/avif', quality)
    })
    return blob
  } catch (error) {
    console.error('Failed to crop image:', error)
    throw new Error(`Не удалось обрезать изображение: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
  }
}

// Обратная совместимость
export const compressImageToJpeg = compressImageToAvif
export const cropImageTo9x16 = cropImageTo9x16Avif

// Построение URL Cloudflare Images из id или полного URL и имени варианта
export function cfImage(input: string, opts?: { variant?: 'avatar' | 'profile' | 'media' | string; width?: number; quality?: number; format?: 'webp' | 'auto' }): string {
  if (!input) return input
  // Don't touch local previews
  if (typeof input === 'string' && input.startsWith('blob:')) return input
  const hash = (import.meta.env.VITE_CF_IMAGES_HASH || '').trim()
  console.log('cfImage called with:', { input, hash, opts })
  const variant = opts?.variant || 'media'
  const isId = /^[a-f0-9\-]{10,}$/i.test(input) && !/^https?:/i.test(input)
  let url = input
  if (isId && hash) {
    url = `https://cdn.spectrmod.com/${hash}/${input}/${variant}`
    console.log('Generated Cloudflare URL:', url)
  } else {
    console.log('Not generating Cloudflare URL:', { isId, hash })
  }
  try {
    const u = new URL(url)
    if (opts?.width) u.searchParams.set('width', String(opts.width))
    if (opts?.quality) u.searchParams.set('quality', String(opts.quality))
    if (opts?.format) u.searchParams.set('format', opts.format)
    const finalUrl = u.toString()
    console.log('Final URL:', finalUrl)
    return finalUrl
  } catch {
    console.log('Failed to parse URL, returning original:', url)
    return url
  }
}


