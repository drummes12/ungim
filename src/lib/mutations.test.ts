import { describe, expect, it } from 'vitest'
import { mergePendingMutation } from './mutations'
import type { EntryMutation, QueuedMutation, RoutineExercise } from './types'

const exercises = (names: string[]): RoutineExercise[] =>
  names.map((name) => ({ name, sets: 3, reps: 10, weight: 20 }))

function routineUpsert(
  id: string,
  routineId: string,
  names: string[],
  expectedVersion: number | null = 1
): EntryMutation {
  return {
    id,
    type: 'upsert-routine',
    profileId: 'ana',
    routineId,
    name: 'Pierna',
    exercises: exercises(names),
    expectedVersion
  }
}

function dayUpsert(id: string, names: string[]): EntryMutation {
  return {
    id,
    type: 'upsert-routine-day',
    profileId: 'ana',
    entryDate: '2026-10-06',
    routineId: 'r1',
    exercises: names.map((name, index) => ({
      name,
      sets: 3,
      reps: 10,
      weight: 20,
      id: index + 1,
      skipped: false,
      done: [false, false, false],
      repsDone: [10, 10, 10]
    })),
    completed: false,
    expectedVersion: 1
  }
}

function queued(mutation: EntryMutation): QueuedMutation {
  return {
    mutation,
    status: 'pending',
    error: null,
    createdAt: '2026-10-06T00:00:00Z'
  }
}

const noneInFlight = () => false

describe('mergePendingMutation', () => {
  it('merges into the last pending upsert for the same routine', () => {
    const queue = [queued(routineUpsert('m1', 'r1', ['a']), )]
    const merged = mergePendingMutation(
      queue,
      routineUpsert('m2', 'r1', ['a', 'b'], 2),
      noneInFlight
    )
    expect(merged).toHaveLength(1)
    const item = merged![0].mutation
    expect(item.id).toBe('m1')
    expect(item.type).toBe('upsert-routine')
    if (item.type === 'upsert-routine') {
      expect(item.exercises.map((ex) => ex.name)).toEqual(['a', 'b'])
      expect(item.expectedVersion).toBe(1)
    }
  })

  it('does not merge a different routine', () => {
    const queue = [queued(routineUpsert('m1', 'r1', ['a']))]
    expect(
      mergePendingMutation(
        queue,
        routineUpsert('m2', 'r2', ['x']),
        noneInFlight
      )
    ).toBeNull()
  })

  it('does not merge into an in-flight mutation', () => {
    const queue = [queued(routineUpsert('m1', 'r1', ['a']))]
    expect(
      mergePendingMutation(queue, routineUpsert('m2', 'r1', ['a', 'b']), () => true)
    ).toBeNull()
  })

  it('skips errored items and merges into the newest pending one', () => {
    const errored = {
      ...queued(routineUpsert('m1', 'r1', ['a'])),
      status: 'error' as const,
      error: 'boom'
    }
    const queue = [
      errored,
      queued(routineUpsert('m2', 'r1', ['a', 'b'], 2))
    ]
    const merged = mergePendingMutation(
      queue,
      routineUpsert('m3', 'r1', ['a', 'b', 'c'], 3),
      noneInFlight
    )
    expect(merged).toHaveLength(2)
    const item = merged![1].mutation
    expect(item.id).toBe('m2')
    if (item.type === 'upsert-routine')
      expect(item.exercises).toHaveLength(3)
  })

  it('keeps queue order when a different-key mutation sits in between', () => {
    const weekday: EntryMutation = {
      id: 'mw',
      type: 'set-routine-weekday',
      profileId: 'ana',
      weekday: 2,
      routineId: 'r1'
    }
    const queue = [
      queued(routineUpsert('m1', 'r1', ['a'])),
      queued(weekday)
    ]
    const merged = mergePendingMutation(
      queue,
      routineUpsert('m2', 'r1', ['a', 'b']),
      noneInFlight
    )
    expect(merged).toHaveLength(2)
    expect(merged![0].mutation.id).toBe('m1')
    if (merged![0].mutation.type === 'upsert-routine')
      expect(merged![0].mutation.exercises).toHaveLength(2)
    expect(merged![1].mutation.id).toBe('mw')
  })

  it('merges routine-day upserts for the same profile and date', () => {
    const queue = [queued(dayUpsert('d1', ['a']))]
    const merged = mergePendingMutation(
      queue,
      dayUpsert('d2', ['a', 'b']),
      noneInFlight
    )
    expect(merged).toHaveLength(1)
    const item = merged![0].mutation
    expect(item.id).toBe('d1')
    if (item.type === 'upsert-routine-day')
      expect(item.exercises).toHaveLength(2)
  })

  it('merges weekday assignments per weekday only', () => {
    const m1: EntryMutation = {
      id: 'w1',
      type: 'set-routine-weekday',
      profileId: 'ana',
      weekday: 2,
      routineId: 'r1'
    }
    const m2: EntryMutation = { ...m1, id: 'w2', weekday: 3 }
    const m3: EntryMutation = { ...m1, id: 'w3', routineId: 'r9' }
    const queue = [queued(m1)]
    expect(mergePendingMutation(queue, m2, noneInFlight)).toBeNull()
    const merged = mergePendingMutation(queue, m3, noneInFlight)
    expect(merged![0].mutation.id).toBe('w1')
    if (merged![0].mutation.type === 'set-routine-weekday')
      expect(merged![0].mutation.routineId).toBe('r9')
  })

  it('returns null for non-coalescable types', () => {
    const del: EntryMutation = {
      id: 'd1',
      type: 'delete-routine',
      profileId: 'ana',
      routineId: 'r1',
      expectedVersion: 1
    }
    const meal: EntryMutation = {
      id: 'mm1',
      type: 'upsert-meal',
      profileId: 'ana',
      entryDate: '2026-10-06',
      mealSlotId: 'slot-1',
      status: 'met',
      expectedVersion: 0
    }
    const queue = [queued(del), queued(meal)]
    expect(mergePendingMutation(queue, del, noneInFlight)).toBeNull()
    expect(mergePendingMutation(queue, meal, noneInFlight)).toBeNull()
  })
})
