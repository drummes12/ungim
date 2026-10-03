const datePattern = /^\d{4}-\d{2}-\d{2}$/

export function assertDateKey(value: string): string {
  if (!datePattern.test(value)) throw new Error(`Invalid date key: ${value}`)
  return value
}

export function parseDateKey(value: string): Date {
  assertDateKey(value)
  return new Date(`${value}T00:00:00.000Z`)
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey)
  date.setUTCDate(date.getUTCDate() + days)
  return toDateKey(date)
}

export function isoWeekStart(dateKey: string): string {
  const date = parseDateKey(dateKey)
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - day + 1)
  return toDateKey(date)
}

export function todayInTimezone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((part) => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function monthKeyForDate(dateKey: string): string {
  return assertDateKey(dateKey).slice(0, 7)
}

export function monthStart(monthKey: string): string {
  return `${monthKey}-01`
}

export function nextMonthStart(monthKey: string): string {
  const date = parseDateKey(monthStart(monthKey))
  date.setUTCMonth(date.getUTCMonth() + 1)
  return toDateKey(date)
}

export function monthEnd(monthKey: string): string {
  return addDays(nextMonthStart(monthKey), -1)
}

export function minDate(a: string, b: string): string {
  return a <= b ? a : b
}

export function maxDate(a: string, b: string): string {
  return a >= b ? a : b
}

export function daysBetween(start: string, end: string): number {
  return Math.round((parseDateKey(end).getTime() - parseDateKey(start).getTime()) / 86_400_000) + 1
}

export function listDates(start: string, end: string): string[] {
  if (start > end) return []
  const dates: string[] = []
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date)
  return dates
}

export function previousMonthKey(monthKey: string): string {
  const date = parseDateKey(monthStart(monthKey))
  date.setUTCMonth(date.getUTCMonth() - 1)
  return toDateKey(date).slice(0, 7)
}

export function formatMonth(monthKey: string): string {
  return new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    parseDateKey(monthStart(monthKey)),
  )
}

export function formatDay(dateKey: string): string {
  return new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    parseDateKey(dateKey),
  )
}

export function formatWeekRange(weekStart: string): string {
  const format = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `${format.format(parseDateKey(weekStart))} – ${format.format(parseDateKey(addDays(weekStart, 6)))}`
}

export function commonTimezones(): string[] {
  return typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC']
}
