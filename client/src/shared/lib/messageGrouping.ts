import { type ChatMessageItem } from '@/shared/api/chat'

type DateTimeGroup = {
  dateKey: string
  label: string
  groups: ChatMessageItem[][]
}

// Сортировка сообщений по времени (Возрастание)
const sortMessagesByCreatedAtAsc = (messages: ChatMessageItem[]): ChatMessageItem[] => {
  return [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

// Группировка сообщений в 1 блок (От 1 отправителя)
const buildTimeGroups = (items: ChatMessageItem[]): ChatMessageItem[][] => {
  const timeGroups: ChatMessageItem[][] = []
  let currentGroup: ChatMessageItem[] = []

  items.forEach((message, index) => {
    if (index === 0) {
      currentGroup = [message]
      return
    }

    const prevMessage = items[index - 1]
    if (!prevMessage) {
      currentGroup.push(message)
      return
    }

    const timeDiff = Math.abs(new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime())
    const isSameSender = message.senderId === prevMessage.senderId
    const isWithin2Min = timeDiff < 2 * 60 * 1000

    if (isSameSender && isWithin2Min) {
      currentGroup.push(message)
    } else {
      if (currentGroup.length > 0) timeGroups.push(currentGroup)
      currentGroup = [message]
    }
  })

  if (currentGroup.length > 0) timeGroups.push(currentGroup)
  return timeGroups
}

export const getDateKey = (dateString: string): string => {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDateLabel = (dateInput: string | Date): string => {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  const now = new Date()

  const getStartOfDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
  const timeDifference = getStartOfDay(now).getTime() - getStartOfDay(date).getTime()
  const oneDayMs = 24 * 60 * 60 * 1000

  if (timeDifference === 0) return 'Сегодня'
  if (timeDifference === oneDayMs) return 'Вчера'

  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

export const groupMessagesByDateAndTime = (messages: ChatMessageItem[]): DateTimeGroup[] => {
  const sorted = sortMessagesByCreatedAtAsc(messages)

  const result: DateTimeGroup[] = []
  let currentDateKey: string | null = null
  let currentDateItems: ChatMessageItem[] = []

  for (const message of sorted) {
    const dateKey = getDateKey(message.createdAt)
    if (currentDateKey === null) {
      currentDateKey = dateKey
      currentDateItems = [message]
      continue
    }

    if (dateKey === currentDateKey) {
      currentDateItems.push(message)
    } else {
      const [yearStr, monthStr, dayStr] = currentDateKey.split('-') as [string, string, string]
      const year = Number(yearStr)
      const month = Number(monthStr || '1')
      const day = Number(dayStr || '1')
      const label = formatDateLabel(new Date(year, month - 1, day))

      result.push({ dateKey: currentDateKey, label, groups: buildTimeGroups(currentDateItems) })

      currentDateKey = dateKey
      currentDateItems = [message]
    }
  }

  if (currentDateKey !== null && currentDateItems.length > 0) {
    const [yearStr, monthStr, dayStr] = currentDateKey.split('-') as [string, string, string]
    const year = Number(yearStr)
    const month = Number(monthStr || '1')
    const day = Number(dayStr || '1')
    const label = formatDateLabel(new Date(year, month - 1, day))
    result.push({ dateKey: currentDateKey, label, groups: buildTimeGroups(currentDateItems) })
  }

  return result
}


