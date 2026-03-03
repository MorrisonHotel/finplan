/** Текущая дата без времени */
export function today(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** ISO строка → Date */
export function parseDate(iso: string): Date {
  return new Date(iso)
}

/** Date → ISO строка (YYYY-MM-DD) */
export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Форматирование даты для отображения */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Форматирование даты — день и месяц (без года) */
export function formatDayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  })
}

/** Название месяца и год */
export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}

/** Добавить месяцы к дате */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

/** Количество дней между двумя датами */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

/** Количество полных месяцев между датами */
export function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  )
}

/** Первый день текущего месяца */
export function startOfMonth(date: Date = today()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/** Последний день текущего месяца */
export function endOfMonth(date: Date = today()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

/** Следующий месяц */
export function nextMonth(date: Date = today()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1)
}

/** Текущее название месяца */
export function currentMonthName(): string {
  return today().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}
