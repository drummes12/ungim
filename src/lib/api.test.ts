import { describe, expect, it } from 'vitest'
import { scopeDashboard } from './api'
import type { Competition, Dashboard } from './types'

const ana = 'ana'
const leo = 'leo'
const max = 'max'

function competition(
  id: string,
  memberIds: string[]
): Competition {
  return {
    id,
    name: id,
    inviteCode: 'ABCDEF',
    homeTimezone: 'UTC',
    startsOn: '2026-01-05',
    createdBy: ana,
    createdAt: '2026-01-01T00:00:00Z',
    members: memberIds.map((profileId) => ({
      profileId,
      status: 'active',
      joinedAt: '2026-01-01T00:00:00Z'
    }))
  }
}

function dashboard(): Dashboard {
  return {
    currentProfileId: ana,
    profiles: [ana, leo, max].map((id) => ({
      id,
      displayName: id,
      avatarColor: '#000',
      configuredAt: '2026-01-01T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z'
    })),
    settings: { homeTimezone: 'UTC', startsOn: '2026-01-05' },
    planVersions: [
      {
        id: `plan-${max}`,
        profileId: max,
        effectiveWeekStart: '2026-01-05',
        workoutTarget: 3,
        freeMealsPerMonth: 4,
        meals: [],
        createdAt: '2026-01-01T00:00:00Z'
      }
    ],
    mealEntries: [
      {
        id: 'meal-1',
        profileId: max,
        mealSlotId: 'slot',
        entryDate: '2026-01-06',
        status: 'met',
        version: 1,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: ''
      }
    ],
    workoutEntries: [],
    freeMealEntries: [],
    extraEntries: [],
    routines: [],
    routineSchedule: Array<string | null>(7).fill(null),
    routineDays: [],
    competitions: [
      competition('pareja', [ana, leo]),
      competition('amigos', [leo, max])
    ],
    months: {
      pareja: {
        '2026-01': {
          monthKey: '2026-01',
          competitionId: 'pareja',
          confirmedBy: [],
          closedAt: null,
          result: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        }
      },
      amigos: {}
    }
  }
}

describe('scopeDashboard', () => {
  it('keeps only active members of the competition', () => {
    const scoped = scopeDashboard(dashboard(), 'pareja')
    expect(scoped.profiles.map((p) => p.id).sort()).toEqual(['ana', 'leo'])
    expect(scoped.settings?.startsOn).toBe('2026-01-05')
  })

  it('drops data from profiles outside the competition', () => {
    const scoped = scopeDashboard(dashboard(), 'pareja')
    expect(scoped.planVersions).toHaveLength(0)
    expect(scoped.mealEntries).toHaveLength(0)
  })

  it('keeps only the competition months', () => {
    const scoped = scopeDashboard(dashboard(), 'pareja')
    expect(Object.keys(scoped.months)).toEqual(['pareja'])
    expect(scoped.months.pareja['2026-01']?.competitionId).toBe('pareja')
  })

  it('attaches joinedAt to member profiles', () => {
    const scoped = scopeDashboard(dashboard(), 'pareja')
    expect(scoped.profiles[0]?.joinedAt).toBe('2026-01-01T00:00:00Z')
  })

  it('excludes paused members', () => {
    const base = dashboard()
    base.competitions[0]!.members[1]!.status = 'paused'
    const scoped = scopeDashboard(base, 'pareja')
    expect(scoped.profiles.map((p) => p.id)).toEqual(['ana'])
  })
})
