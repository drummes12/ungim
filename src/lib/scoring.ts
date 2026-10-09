import {
  addDays,
  daysBetween,
  isoWeekStart,
  maxDate,
  minDate,
  monthEnd,
  monthStart,
  todayInTimezone
} from './dates'
import type {
  Dashboard,
  MealEntry,
  MealSlot,
  MonthResult,
  ParticipantScore,
  PlanVersion,
  Profile
} from './types'

export function activePlanForWeek(
  dashboard: Dashboard,
  profileId: string,
  weekStart: string
): PlanVersion | null {
  const versions = dashboard.planVersions
    .filter(
      (plan) =>
        plan.profileId === profileId && plan.effectiveWeekStart <= weekStart
    )
    .sort((a, b) => b.effectiveWeekStart.localeCompare(a.effectiveWeekStart))
  return versions[0] ?? null
}

export function activePlanForDate(
  dashboard: Dashboard,
  profileId: string,
  date: string
): PlanVersion | null {
  return activePlanForWeek(dashboard, profileId, isoWeekStart(date))
}

export function mealsForDate(
  dashboard: Dashboard,
  profileId: string,
  date: string
): MealSlot[] {
  return (
    activePlanForDate(dashboard, profileId, date)
      ?.meals.slice()
      .sort((a, b) => a.position - b.position) ?? []
  )
}

export function mealEntryFor(
  dashboard: Dashboard,
  profileId: string,
  mealSlotId: string,
  date: string
): MealEntry | null {
  return (
    dashboard.mealEntries.find(
      (entry) =>
        entry.profileId === profileId &&
        entry.mealSlotId === mealSlotId &&
        entry.entryDate === date
    ) ?? null
  )
}

export function workoutForDate(
  dashboard: Dashboard,
  profileId: string,
  date: string
) {
  return (
    dashboard.workoutEntries.find(
      (entry) => entry.profileId === profileId && entry.entryDate === date
    ) ?? null
  )
}

export function freeMealEntryFor(
  dashboard: Dashboard,
  profileId: string,
  date: string
) {
  return (
    dashboard.freeMealEntries.find(
      (entry) => entry.profileId === profileId && entry.entryDate === date
    ) ?? null
  )
}

export const EXTRA_LEVEL_POINTS: Record<number, number> = {
  1: 0.5,
  2: 1,
  3: 2
}

export const EXTRA_MONTH_CAP = 6

export function extraEntryFor(
  dashboard: Dashboard,
  profileId: string,
  date: string
) {
  return (
    dashboard.extraEntries.find(
      (entry) => entry.profileId === profileId && entry.entryDate === date
    ) ?? null
  )
}

export function sumExtraPoints(
  dashboard: Dashboard,
  profileId: string,
  start: string,
  end: string
): number {
  const raw = dashboard.extraEntries.reduce(
    (total, entry) =>
      entry.profileId === profileId &&
      entry.entryDate >= start &&
      entry.entryDate <= end
        ? total + (EXTRA_LEVEL_POINTS[entry.level] ?? 0)
        : total,
    0
  )
  return Math.min(EXTRA_MONTH_CAP, raw)
}

export function countFreeMeals(
  dashboard: Dashboard,
  profileId: string,
  start: string,
  end: string
): number {
  return dashboard.freeMealEntries.reduce(
    (total, entry) =>
      entry.profileId === profileId &&
      entry.entryDate >= start &&
      entry.entryDate <= end
        ? total + entry.count
        : total,
    0
  )
}

function countWorkouts(
  dashboard: Dashboard,
  profileId: string,
  start: string,
  end: string
): number {
  return dashboard.workoutEntries.filter(
    (entry) =>
      entry.profileId === profileId &&
      entry.entryDate >= start &&
      entry.entryDate <= end
  ).length
}

function countMetMealsForPlan(
  dashboard: Dashboard,
  profileId: string,
  plan: PlanVersion,
  start: string,
  end: string
): number {
  const slotIds = new Set(plan.meals.map((meal) => meal.id))
  return dashboard.mealEntries.filter(
    (entry) =>
      entry.profileId === profileId &&
      slotIds.has(entry.mealSlotId) &&
      entry.entryDate >= start &&
      entry.entryDate <= end &&
      entry.status === 'met'
  ).length
}

export function isPerfectWeek(
  dashboard: Dashboard,
  profileId: string,
  weekStart: string,
  competitionStart: string
): boolean {
  if (weekStart < competitionStart) return false
  const plan = activePlanForWeek(dashboard, profileId, weekStart)
  if (!plan || plan.meals.length === 0) return false
  const weekEnd = addDays(weekStart, 6)
  const mealsMet = countMetMealsForPlan(
    dashboard,
    profileId,
    plan,
    weekStart,
    weekEnd
  )
  return (
    mealsMet === plan.meals.length * 7 &&
    countWorkouts(dashboard, profileId, weekStart, weekEnd) >=
      plan.workoutTarget &&
    countFreeMeals(dashboard, profileId, weekStart, weekEnd) === 0
  )
}

export function consecutiveMealDays(
  dashboard: Dashboard,
  profileId: string,
  asOfDate: string
): number {
  const competitionStart = dashboard.settings?.startsOn
  if (!competitionStart || asOfDate < competitionStart) return 0

  let date = asOfDate
  let streak = 0
  while (date >= competitionStart) {
    const meals = mealsForDate(dashboard, profileId, date)
    if (meals.length === 0) break
    const entries = meals.map((meal) =>
      mealEntryFor(dashboard, profileId, meal.id, date)
    )
    if (
      date === asOfDate &&
      entries.some((entry) => !entry) &&
      !entries.some((entry) => entry?.status === 'missed')
    ) {
      date = addDays(date, -1)
      continue
    }
    if (entries.every((entry) => entry?.status === 'met')) {
      streak += 1
      date = addDays(date, -1)
      continue
    }
    break
  }
  return streak
}

export function perfectWeekStreak(
  dashboard: Dashboard,
  profileId: string,
  asOfDate: string
): number {
  const competitionStart = dashboard.settings?.startsOn
  if (!competitionStart || asOfDate < competitionStart) return 0

  let week = isoWeekStart(asOfDate)
  if (asOfDate !== addDays(week, 6)) week = addDays(week, -7)
  let streak = 0
  while (
    week >= competitionStart &&
    isPerfectWeek(dashboard, profileId, week, competitionStart)
  ) {
    streak += 1
    week = addDays(week, -7)
  }
  return streak
}

export function computeMonthScore(
  dashboard: Dashboard,
  monthKey: string,
  asOfDate?: string
): MonthResult {
  const timezone = dashboard.settings?.homeTimezone ?? 'UTC'
  const competitionStart = dashboard.settings?.startsOn ?? null
  const start = monthStart(monthKey)
  const end = monthEnd(monthKey)
  const today = asOfDate ?? todayInTimezone(timezone)
  const cutoff = minDate(end, today)

  const participants = dashboard.profiles.map((profile) =>
    computeParticipantScore(
      dashboard,
      profile,
      competitionStart,
      start,
      end,
      cutoff
    )
  )
  const scorable = participants.filter((participant) => !participant.noData)
  const maxTotal = Math.max(
    ...scorable.map((participant) => participant.total),
    -Infinity
  )
  const tiedByTotal = scorable.filter(
    (participant) => participant.total === maxTotal
  )
  const maxBase = Math.max(
    ...tiedByTotal.map((participant) => participant.base),
    -Infinity
  )

  return {
    monthKey,
    timezone,
    participants,
    winnerIds: tiedByTotal
      .filter((participant) => participant.base === maxBase)
      .map((p) => p.profileId),
    computedAt: new Date().toISOString()
  }
}

function computeParticipantScore(
  dashboard: Dashboard,
  profile: Profile,
  competitionStart: string | null,
  monthStartDate: string,
  monthEndDate: string,
  cutoff: string
): ParticipantScore {
  const empty = {
    profileId: profile.id,
    name: profile.displayName,
    color: profile.avatarColor,
    noData: true,
    base: 0,
    bonus: 0,
    total: 0,
    streak: 0,
    workout: { earned: 0, target: 0 },
    meals: { met: 0, planned: 0 },
    freeMeals: { used: 0, quota: 0 },
    extraPoints: 0
  }
  if (!competitionStart || cutoff < competitionStart) return empty

  const eligibleStart = maxDate(monthStartDate, competitionStart)
  const eligibleEnd = minDate(monthEndDate, cutoff)
  if (eligibleStart > eligibleEnd) return empty

  let workoutEarned = 0
  let workoutTarget = 0
  let mealsPlanned = 0
  for (
    let week = isoWeekStart(eligibleStart);
    week <= eligibleEnd;
    week = addDays(week, 7)
  ) {
    const segmentStart = maxDate(week, eligibleStart)
    const segmentEnd = minDate(addDays(week, 6), eligibleEnd)
    const segmentDays = daysBetween(segmentStart, segmentEnd)
    const plan = activePlanForWeek(dashboard, profile.id, week)
    if (!plan) continue

    const segmentTarget = Math.ceil((plan.workoutTarget * segmentDays) / 7)
    workoutTarget += segmentTarget
    workoutEarned += Math.min(
      countWorkouts(dashboard, profile.id, segmentStart, segmentEnd),
      segmentTarget
    )
    mealsPlanned += plan.meals.length * segmentDays
  }

  const mealsMet = dashboard.mealEntries.filter((entry) => {
    if (
      entry.profileId !== profile.id ||
      entry.entryDate < eligibleStart ||
      entry.entryDate > eligibleEnd
    ) {
      return false
    }
    const plan = activePlanForDate(dashboard, profile.id, entry.entryDate)
    return (
      entry.status === 'met' &&
      plan?.meals.some((meal) => meal.id === entry.mealSlotId)
    )
  }).length

  const freeQuota =
    activePlanForDate(dashboard, profile.id, eligibleEnd)
      ?.freeMealsPerMonth ?? 0
  const freeUsed = countFreeMeals(
    dashboard,
    profile.id,
    eligibleStart,
    eligibleEnd
  )
  mealsPlanned += Math.max(0, freeUsed - freeQuota)

  let bonus = 0
  for (
    let week = isoWeekStart(eligibleStart);
    week <= eligibleEnd;
    week = addDays(week, 7)
  ) {
    const weekEnd = addDays(week, 6)
    if (
      week >= competitionStart &&
      weekEnd <= eligibleEnd &&
      weekEnd >= monthStartDate &&
      weekEnd <= monthEndDate &&
      isPerfectWeek(dashboard, profile.id, week, competitionStart)
    ) {
      bonus = Math.min(10, bonus + 2)
    }
  }

  const streak = perfectWeekStreak(dashboard, profile.id, eligibleEnd)

  const extraPoints = sumExtraPoints(
    dashboard,
    profile.id,
    eligibleStart,
    eligibleEnd
  )

  const base =
    (workoutTarget ? workoutEarned / workoutTarget : 0) * 50 +
    (mealsPlanned ? mealsMet / mealsPlanned : 0) * 50
  const roundedBase = Math.round(base * 1000) / 1000
  return {
    ...empty,
    noData: workoutTarget === 0 && mealsPlanned === 0,
    base: roundedBase,
    bonus,
    total: Math.round((roundedBase + bonus + extraPoints) * 1000) / 1000,
    streak,
    workout: { earned: workoutEarned, target: workoutTarget },
    meals: { met: mealsMet, planned: mealsPlanned },
    freeMeals: { used: freeUsed, quota: freeQuota },
    extraPoints
  }
}

export interface DayStatus {
  planned: number
  met: number
  missed: number
  free: number
  extra: number
  workout: boolean
  future: boolean
  active: boolean
}

export function dayStatus(
  dashboard: Dashboard,
  profileId: string,
  date: string,
  today: string
): DayStatus {
  const start = dashboard.settings?.startsOn ?? null
  const meals = mealsForDate(dashboard, profileId, date)
  const entries = meals.map((meal) =>
    mealEntryFor(dashboard, profileId, meal.id, date)
  )
  return {
    planned: meals.length,
    met: entries.filter((entry) => entry?.status === 'met').length,
    missed: entries.filter((entry) => entry?.status === 'missed').length,
    free: freeMealEntryFor(dashboard, profileId, date)?.count ?? 0,
    extra: extraEntryFor(dashboard, profileId, date)?.level ?? 0,
    workout: Boolean(workoutForDate(dashboard, profileId, date)),
    future: date > today,
    active: Boolean(start && date >= start && date <= today)
  }
}

export interface ScorePoint {
  date: string
  totals: Record<string, number | null>
}

export function scoreSeries(
  dashboard: Dashboard,
  monthKey: string,
  today: string
): ScorePoint[] {
  const start = dashboard.settings?.startsOn
  if (!start) return []
  const first = maxDate(monthStart(monthKey), start)
  const last = minDate(monthEnd(monthKey), today)
  const points: ScorePoint[] = []
  for (let date = first; date <= last; date = addDays(date, 1)) {
    const result = computeMonthScore(dashboard, monthKey, date)
    points.push({
      date,
      totals: Object.fromEntries(
        result.participants.map((participant) => [
          participant.profileId,
          participant.noData ? null : participant.total
        ])
      )
    })
  }
  return points
}

export function workoutProgressThisWeek(
  dashboard: Dashboard,
  profileId: string,
  date: string
) {
  const week = isoWeekStart(date)
  const plan = activePlanForWeek(dashboard, profileId, week)
  const done = countWorkouts(dashboard, profileId, week, addDays(week, 6))
  return { done, target: plan?.workoutTarget ?? 0, plan }
}
