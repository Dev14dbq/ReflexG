/**
 * Безопасно парсит дату из различных форматов
 * @param dateInput - строка или дата для парсинга
 * @returns валидная дата или null если не удалось распарсить
 */
export function safeParseDate(dateInput: string | Date | null | undefined): Date | null {
  if (!dateInput) return null
  
  // Если уже Date объект, проверяем валидность
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput
  }
  
  // Если строка, пробуем разные форматы
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim()
    if (!trimmed) return null
    
    // Пробуем стандартный ISO формат
    let date = new Date(trimmed)
    if (!isNaN(date.getTime())) return date
    
    // Пробуем формат DD/MM/YYYY
    const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      if (!isNaN(date.getTime())) return date
    }
    
    // Пробуем формат MM/DD/YYYY
    const mmddyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (mmddyyyyMatch) {
      const [, month, day, year] = mmddyyyyMatch
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      if (!isNaN(date.getTime())) return date
    }
    
    // Пробуем формат YYYY-MM-DD
    const yyyymmddMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (yyyymmddMatch) {
      const [, year, month, day] = yyyymmddMatch
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      if (!isNaN(date.getTime())) return date
    }
  }
  
  return null
}

/**
 * Проверяет, является ли дата валидной
 * @param date - дата для проверки
 * @returns true если дата валидна
 */
export function isValidDate(date: Date | null): date is Date {
  return date !== null && !isNaN(date.getTime())
}
