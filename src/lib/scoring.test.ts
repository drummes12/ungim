import { describe, expect, it } from 'vitest'
import { addDays, isoWeekStart } from './dates'
import {
  computeMonthScore,
  consecutiveMealDays,
  dayStatus,
  isPerfectWeek,
  perfectWeekStreak,
  scoreSeries
} from './scoring'
import type {
  Dashboard,
  ExtraEntry,
  FreeMealEntry,
  MealEntry,
  PlanVersion,
  WorkoutEntry
} from './types'

function dashboard(
  plans: PlanVersion[],
  mealEntries: MealEntry[],
  workoutEntries: WorkoutEntry[],
  startsOn = '2026-01-05',
  freeMealEntries: FreeMealEntry[] = [],
  extraEntries: ExtraEntry[] = []
): Dashboard {
  return {
    currentProfileId: 'ana',
    profiles: [
      {
        id: 'ana',
        displayName: 'Ana',
        avatarColor: '#f05a43',
        configuredAt: '',
        createdAt: ''
      },
      {
        id: 'leo',
        displayName: 'Leo',
        avatarColor: '#2f6fdd',
        configuredAt: '',
        createdAt: ''
      }
    ],
    settings: { homeTimezone: 'UTC', startsOn },
    planVersions: plans,
    mealEntries,
    workoutEntries,
    freeMealEntries,
    extraEntries,
    routines: [],
    routineSchedule: Array<string | null>(7).fill(null),
    routineDays: [],
    competitions: [],
    months: {}
  }
}

function plan(
  profileId: string,
  week: string,
  target: number,
  meals: number,
  freeMealsPerMonth = 0
): PlanVersion {
  return {
    id: `plan-${profileId}-${week}`,
    profileId,
    effectiveWeekStart: week,
    workoutTarget: target,
    freeMealsPerMonth,
    createdAt: '',
    meals: Array.from({ length: meals }, (_, index) => ({
      id: `${profileId}-meal-${index + 1}`,
      name: `Comida ${index + 1}`,
      rule: 'Plan',
      position: index + 1
    }))
  }
}

function meal(
  profileId: string,
  slotId: string,
  date: string,
  status: 'met' | 'missed'
): MealEntry {
  return {
    id: `${profileId}-${slotId}-${date}`,
    profileId,
    mealSlotId: slotId,
    entryDate: date,
    status,
    version: 1,
    createdAt: '',
    updatedAt: ''
  }
}

function workout(profileId: string, date: string): WorkoutEntry {
  return {
    id: `${profileId}-${date}`,
    profileId,
    entryDate: date,
    workoutType: null,
    note: null,
    version: 1,
    createdAt: '',
    updatedAt: ''
  }
}

function freeMeal(
  profileId: string,
  date: string,
  count = 1
): FreeMealEntry {
  return {
    id: `${profileId}-free-${date}`,
    profileId,
    entryDate: date,
    count,
    note: null,
    version: 1,
    createdAt: '',
    updatedAt: ''
  }
}

function extra(
  profileId: string,
  date: string,
  level: ExtraEntry['level'] = 2
): ExtraEntry {
  return {
    id: `${profileId}-extra-${date}`,
    profileId,
    entryDate: date,
    level,
    note: null,
    version: 1,
    createdAt: '',
    updatedAt: ''
  }
}

function fillMeals(
  profileId: string,
  planVersion: PlanVersion,
  start: string,
  end: string,
  met = true
): MealEntry[] {
  const entries: MealEntry[] = []
  for (let date = start; date <= end; date = addDays(date, 1)) {
    for (const slot of planVersion.meals)
      entries.push(meal(profileId, slot.id, date, met ? 'met' : 'missed'))
  }
  return entries
}

describe('monthly competition scoring', () => {
  it('compares separate plans by percentage and caps extra workouts', () => {
    const anaPlan = plan('ana', '2026-01-05', 2, 3)
    const leoPlan = plan('leo', '2026-01-05', 4, 2)
    const entries = [
      ...fillMeals('ana', anaPlan, '2026-01-05', '2026-01-11').slice(0, 14),
      ...fillMeals('leo', leoPlan, '2026-01-05', '2026-01-11')
    ]
    const workouts = [
      workout('ana', '2026-01-05'),
      workout('ana', '2026-01-06'),
      workout('ana', '2026-01-07'),
      ...['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08'].map((date) =>
        workout('leo', date)
      )
    ]
    const result = computeMonthScore(
      dashboard([anaPlan, leoPlan], entries, workouts),
      '2026-01',
      '2026-01-31'
    )
    const ana = result.participants.find((item) => item.profileId === 'ana')!
    const leo = result.participants.find((item) => item.profileId === 'leo')!
    expect(ana.workout).toEqual({ earned: 2, target: 8 })
    expect(ana.meals).toEqual({ met: 14, planned: 81 })
    expect(ana.total).toBeCloseTo(21.14, 2)
    expect(leo.total).toBeGreaterThan(ana.total)
  })

  it('adds two donuts for a completed perfect ISO week', () => {
    const anaPlan = plan('ana', '2026-01-05', 2, 1)
    const entries = fillMeals('ana', anaPlan, '2026-01-05', '2026-01-11')
    const workouts = [
      workout('ana', '2026-01-05'),
      workout('ana', '2026-01-08')
    ]
    const data = dashboard(
      [anaPlan, plan('leo', '2026-01-05', 1, 1)],
      entries,
      workouts
    )
    const week = isoWeekStart('2026-01-08')
    expect(isPerfectWeek(data, 'ana', week, '2026-01-05')).toBe(true)
    const result = computeMonthScore(data, '2026-01', '2026-01-12')
    expect(result.participants[0].bonus).toBe(2)
    expect(result.participants[0].streak).toBe(1)
  })

  it('prorates the split week objective and assigns its bonus to Sunday month', () => {
    const anaPlan = plan('ana', '2026-01-26', 7, 1)
    const entries = fillMeals('ana', anaPlan, '2026-01-26', '2026-02-01')
    const workouts = [
      ...[
        '2026-01-26',
        '2026-01-27',
        '2026-01-28',
        '2026-01-29',
        '2026-01-30',
        '2026-01-31'
      ].map((date) => workout('ana', date)),
      workout('ana', '2026-02-01')
    ]
    const data = dashboard(
      [anaPlan, plan('leo', '2026-01-05', 1, 1)],
      entries,
      workouts,
      '2026-01-26'
    )
    const january = computeMonthScore(data, '2026-01', '2026-01-31')
    const february = computeMonthScore(data, '2026-02', '2026-02-28')
    expect(january.participants[0].workout).toEqual({ earned: 6, target: 6 })
    expect(january.participants[0].bonus).toBe(0)
    expect(february.participants[0].workout).toEqual({ earned: 1, target: 28 })
    expect(february.participants[0].bonus).toBe(2)
  })

  it('does not award a bonus for the partial first competition week', () => {
    const anaPlan = plan('ana', '2026-01-05', 7, 1)
    const entries = fillMeals('ana', anaPlan, '2026-01-07', '2026-01-11')
    const workouts = [
      '2026-01-07',
      '2026-01-08',
      '2026-01-09',
      '2026-01-10',
      '2026-01-11'
    ].map((date) => workout('ana', date))
    const data = dashboard(
      [anaPlan, plan('leo', '2026-01-05', 1, 1)],
      entries,
      workouts,
      '2026-01-07'
    )
    const result = computeMonthScore(data, '2026-01', '2026-01-31')
    expect(result.participants[0].workout.target).toBe(25)
    expect(result.participants[0].bonus).toBe(0)
  })

  it('reports per-day status for charts', () => {
    const anaPlan = plan('ana', '2026-01-05', 2, 2)
    const entries = [
      meal('ana', 'ana-meal-1', '2026-01-06', 'met'),
      meal('ana', 'ana-meal-2', '2026-01-06', 'missed')
    ]
    const data = dashboard(
      [anaPlan, plan('leo', '2026-01-05', 1, 1)],
      entries,
      [workout('ana', '2026-01-06')],
      '2026-01-05',
      [freeMeal('ana', '2026-01-06', 2)],
      [extra('ana', '2026-01-06', 2)]
    )
    expect(dayStatus(data, 'ana', '2026-01-06', '2026-01-10')).toEqual({
      planned: 2,
      met: 1,
      missed: 1,
      free: 2,
      extra: 2,
      workout: true,
      future: false,
      active: true
    })
    expect(dayStatus(data, 'ana', '2026-01-12', '2026-01-10')).toMatchObject({
      future: true,
      active: false
    })
    expect(dayStatus(data, 'ana', '2026-01-04', '2026-01-10').active).toBe(
      false
    )
  })

  it('builds one score point per eligible day', () => {
    const anaPlan = plan('ana', '2026-01-05', 1, 1)
    const data = dashboard(
      [anaPlan, plan('leo', '2026-01-05', 1, 1)],
      fillMeals('ana', anaPlan, '2026-01-05', '2026-01-06'),
      [workout('ana', '2026-01-05')]
    )
    const series = scoreSeries(data, '2026-01', '2026-01-07')
    expect(series.map((point) => point.date)).toEqual([
      '2026-01-05',
      '2026-01-06',
      '2026-01-07'
    ])
    expect(series[0].totals.ana).toBeGreaterThan(series[0].totals.leo ?? 0)
    expect(scoreSeries(data, '2025-11', '2026-01-07')).toEqual([])
  })

  it('keeps free meals within quota neutral but breaks the perfect week', () => {
    const anaPlan = plan('ana', '2026-01-05', 2, 1, 4)
    const entries = fillMeals('ana', anaPlan, '2026-01-05', '2026-01-11')
    const workouts = [
      workout('ana', '2026-01-05'),
      workout('ana', '2026-01-08')
    ]
    const data = dashboard(
      [anaPlan, plan('leo', '2026-01-05', 1, 1)],
      entries,
      workouts,
      '2026-01-05',
      [freeMeal('ana', '2026-01-07')]
    )
    const week = isoWeekStart('2026-01-08')
    expect(isPerfectWeek(data, 'ana', week, '2026-01-05')).toBe(false)
    const result = computeMonthScore(data, '2026-01', '2026-01-12')
    const ana = result.participants[0]
    expect(ana.freeMeals).toEqual({ used: 1, quota: 4 })
    expect(ana.meals).toEqual({ met: 7, planned: 8 })
    expect(ana.bonus).toBe(0)
  })

  it('counts free meals beyond the monthly quota as missed meals', () => {
    const anaPlan = plan('ana', '2026-01-05', 1, 1, 2)
    const entries = fillMeals('ana', anaPlan, '2026-01-05', '2026-01-12')
    const data = dashboard(
      [anaPlan, plan('leo', '2026-01-05', 1, 1)],
      entries,
      [],
      '2026-01-05',
      [
        freeMeal('ana', '2026-01-06'),
        freeMeal('ana', '2026-01-07'),
        freeMeal('ana', '2026-01-08', 2)
      ]
    )
    const result = computeMonthScore(data, '2026-01', '2026-01-12')
    const ana = result.participants[0]
    expect(ana.freeMeals).toEqual({ used: 4, quota: 2 })
    expect(ana.meals).toEqual({ met: 8, planned: 10 })
  })

  it('counts every free meal as a miss when the quota is zero', () => {
    const anaPlan = plan('ana', '2026-01-05', 1, 1, 0)
    const entries = fillMeals('ana', anaPlan, '2026-01-05', '2026-01-12')
    const data = dashboard(
      [anaPlan, plan('leo', '2026-01-05', 1, 1)],
      entries,
      [],
      '2026-01-05',
      [freeMeal('ana', '2026-01-06', 2)]
    )
    const result = computeMonthScore(data, '2026-01', '2026-01-12')
    const ana = result.participants[0]
    expect(ana.freeMeals).toEqual({ used: 2, quota: 0 })
    expect(ana.meals).toEqual({ met: 8, planned: 10 })
  })

  it('adds extra activity points by level and caps them at six per month', () => {
    const anaPlan = plan('ana', '2026-01-05', 1, 1)
    const entries = fillMeals('ana', anaPlan, '2026-01-05', '2026-01-11')
    const data = dashboard(
      [anaPlan, plan('leo', '2026-01-05', 1, 1)],
      entries,
      [workout('ana', '2026-01-05')],
      '2026-01-05',
      [],
      [
        extra('ana', '2026-01-05', 1),
        extra('ana', '2026-01-06', 2),
        extra('ana', '2026-01-07', 3),
        extra('ana', '2026-01-08', 3),
        extra('ana', '2026-01-09', 3)
      ]
    )
    const result = computeMonthScore(data, '2026-01', '2026-01-12')
    const ana = result.participants[0]
    expect(ana.extraPoints).toBe(6)
    expect(ana.total).toBeCloseTo(ana.base + ana.bonus + 6, 3)
  })

  it('keeps extra activity out of the perfect week check', () => {
    const anaPlan = plan('ana', '2026-01-05', 2, 1)
    const entries = fillMeals('ana', anaPlan, '2026-01-05', '2026-01-11')
    const workouts = [
      workout('ana', '2026-01-05'),
      workout('ana', '2026-01-08')
    ]
    const data = dashboard(
      [anaPlan, plan('leo', '2026-01-05', 1, 1)],
      entries,
      workouts,
      '2026-01-05',
      [],
      [extra('ana', '2026-01-07', 3)]
    )
    const week = isoWeekStart('2026-01-08')
    expect(isPerfectWeek(data, 'ana', week, '2026-01-05')).toBe(true)
    const result = computeMonthScore(data, '2026-01', '2026-01-12')
    const ana = result.participants[0]
    expect(ana.bonus).toBe(2)
    expect(ana.extraPoints).toBe(2)
  })

  it('uses exact base score for ties and can share a true tie', () => {
    const anaPlan = plan('ana', '2026-01-05', 1, 1)
    const leoPlan = plan('leo', '2026-01-05', 1, 1)
    const entries = [
      ...fillMeals('ana', anaPlan, '2026-01-05', '2026-01-11'),
      ...fillMeals('leo', leoPlan, '2026-01-05', '2026-01-11')
    ]
    const workouts = [
      workout('ana', '2026-01-05'),
      workout('leo', '2026-01-05')
    ]
    const result = computeMonthScore(
      dashboard([anaPlan, leoPlan], entries, workouts),
      '2026-01',
      '2026-01-12'
    )
    expect(result.winnerIds.sort()).toEqual(['ana', 'leo'])
  })

  it('counts consecutive full meal days and leaves an unfinished current day alone', () => {
    const anaPlan = plan('ana', '2026-01-05', 2, 2)
    const entries = fillMeals('ana', anaPlan, '2026-01-05', '2026-01-07')
    const data = dashboard([anaPlan], entries, [], '2026-01-05')

    expect(consecutiveMealDays(data, 'ana', '2026-01-07')).toBe(3)
    expect(consecutiveMealDays(data, 'ana', '2026-01-08')).toBe(3)
  })

  it('breaks a meal streak immediately when a meal is missed today', () => {
    const anaPlan = plan('ana', '2026-01-05', 2, 1)
    const entries = [
      meal('ana', anaPlan.meals[0].id, '2026-01-05', 'met'),
      meal('ana', anaPlan.meals[0].id, '2026-01-06', 'missed')
    ]
    const data = dashboard([anaPlan], entries, [], '2026-01-05')

    expect(consecutiveMealDays(data, 'ana', '2026-01-06')).toBe(0)
  })

  it('counts consecutive perfect weeks, including only completed weeks', () => {
    const anaPlan = plan('ana', '2026-01-05', 2, 1)
    const entries = fillMeals('ana', anaPlan, '2026-01-05', '2026-01-18')
    const workouts = [
      workout('ana', '2026-01-05'),
      workout('ana', '2026-01-08'),
      workout('ana', '2026-01-12'),
      workout('ana', '2026-01-15')
    ]
    const data = dashboard([anaPlan], entries, workouts, '2026-01-05')

    expect(perfectWeekStreak(data, 'ana', '2026-01-18')).toBe(2)
    expect(perfectWeekStreak(data, 'ana', '2026-01-19')).toBe(2)
  })
})
