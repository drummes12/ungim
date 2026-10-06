import type { Dashboard, RoutineDay } from './types'

// JS getDay() → index (0 = lunes … 6 = domingo)
export function weekdayIndex(date: Date) {
  return (date.getDay() + 6) % 7
}

export function routineDayFor(
  dashboard: Dashboard,
  profileId: string,
  date: string
): RoutineDay | undefined {
  return dashboard.routineDays.find(
    (day) => day.profileId === profileId && day.entryDate === date
  )
}
