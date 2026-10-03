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
      plan.workoutTarget
  )
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
    meals: { met: 0, planned: 0 }
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

  let streak = 0
  let week = isoWeekStart(eligibleEnd)
  if (eligibleEnd !== addDays(week, 6)) week = addDays(week, -7)
  while (
    week >= competitionStart &&
    isPerfectWeek(dashboard, profile.id, week, competitionStart)
  ) {
    streak += 1
    week = addDays(week, -7)
  }

  const base =
    (workoutTarget ? workoutEarned / workoutTarget : 0) * 50 +
    (mealsPlanned ? mealsMet / mealsPlanned : 0) * 50
  const roundedBase = Math.round(base * 1000) / 1000
  return {
    ...empty,
    noData: workoutTarget === 0 && mealsPlanned === 0,
    base: roundedBase,
    bonus,
    total: Math.round((roundedBase + bonus) * 1000) / 1000,
    streak,
    workout: { earned: workoutEarned, target: workoutTarget },
    meals: { met: mealsMet, planned: mealsPlanned }
  }
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
