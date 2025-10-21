import { Bot } from 'grammy'
import { prisma } from '@/lib/prisma'
import { ENV } from '@/config/env'

interface TelegramSticker {
  file_id: string
  file_unique_id: string
  type: string
  width: number
  height: number
  is_animated: boolean
  is_video: boolean
  emoji?: string
  set_name?: string
}

interface TelegramStickerSet {
  name: string
  title: string
  is_animated: boolean
  is_video: boolean
  contains_masks: boolean
  stickers: TelegramSticker[]
}

export async function importStickerPackFromTelegram(telegramUrl: string, userId: bigint): Promise<{ success: boolean; packId?: string; error?: string }> {
  try {
    // Extract sticker set name from URL
    // Format: https://t.me/addstickers/NAME or https://t.me/addstickers/NAME
    const urlMatch = telegramUrl.match(/t\.me\/addstickers\/([a-zA-Z0-9_]+)/)
    if (!urlMatch) {
      return { success: false, error: 'Invalid Telegram sticker URL format' }
    }
    
    const setName = urlMatch[1]
    
    // Initialize bot
    const bot = new Bot(ENV.TELEGRAM_BOT_TOKEN || '')
    
    // Get sticker set from Telegram
    let stickerSet: any
    try {
      stickerSet = await bot.api.getStickerSet(setName)
    } catch (error) {
      console.error('Failed to get sticker set from Telegram:', error)
      return { success: false, error: 'Sticker set not found or not accessible' }
    }
    
    // Check if pack already exists
    const existingPack = await prisma.stickerPack.findFirst({
      where: { 
        name: stickerSet.title,
        users: {
          some: { userId }
        }
      }
    })
    
    if (existingPack) {
      return { success: false, error: 'Sticker pack already imported' }
    }
    
    // Create sticker pack
    const pack = await prisma.stickerPack.create({
      data: {
        name: stickerSet.title,
        description: `Imported from Telegram: ${setName}`,
        isOfficial: false,
        isActive: true
      }
    })
    
    // Create stickers
    const stickers = await Promise.all(
      stickerSet.stickers.map(async (sticker: any, index: number) => {
        // Download sticker file
        const file = await bot.api.getFile(sticker.file_id)
        const fileUrl = `https://api.telegram.org/file/bot${ENV.TELEGRAM_BOT_TOKEN}/${file.file_path}`
        
        // Download and convert to AVIF
        const response = await fetch(fileUrl)
        if (!response.ok) {
          throw new Error(`Failed to download sticker: ${response.statusText}`)
        }
        
        const buffer = await response.arrayBuffer()
        
        // Upload to Cloudflare Images
        const formData = new FormData()
        const blob = new Blob([buffer], { type: 'image/webp' })
        formData.append('file', blob, `sticker_${sticker.file_unique_id}.webp`)
        
        // Generate deterministic ID
        const crypto = await import('crypto')
        const hash = crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex').slice(0, 16)
        formData.append('id', hash)
        
        const uploadResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ENV.CLOUDFLARE_ACCOUNT_ID}/images/v1`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ENV.CLOUDFLARE_API_TOKEN}`
          },
          body: formData
        })
        
        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text()
          console.error('Cloudflare upload failed:', errorText)
          throw new Error('Failed to upload sticker to CDN')
        }
        
        const uploadResult = await uploadResponse.json() as any
        const imageId = uploadResult.result?.id || hash
        
        return prisma.sticker.create({
          data: {
            packId: pack.id,
            name: sticker.emoji || `Sticker ${index + 1}`,
            imageUrl: imageId,
            emoji: sticker.emoji,
            position: index
          }
        })
      })
    )
    
    // Set thumbnail (first sticker)
    if (stickers.length > 0) {
      await prisma.stickerPack.update({
        where: { id: pack.id },
        data: { thumbnail: stickers[0].imageUrl }
      })
    }
    
    // Add pack to user
    await prisma.userStickerPack.create({
      data: {
        userId,
        packId: pack.id
      }
    })
    
    return { success: true, packId: pack.id }
    
  } catch (error) {
    console.error('Error importing sticker pack:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function addStickerPackToUser(packId: string, userId: bigint): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if pack exists and is active
    const pack = await prisma.stickerPack.findFirst({
      where: { id: packId, isActive: true }
    })
    
    if (!pack) {
      return { success: false, error: 'Sticker pack not found' }
    }
    
    // Check if user already has this pack
    const existing = await prisma.userStickerPack.findUnique({
      where: { userId_packId: { userId, packId } }
    })
    
    if (existing) {
      return { success: false, error: 'User already has this sticker pack' }
    }
    
    // Add pack to user
    await prisma.userStickerPack.create({
      data: {
        userId,
        packId
      }
    })
    
    return { success: true }
    
  } catch (error) {
    console.error('Error adding sticker pack to user:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
