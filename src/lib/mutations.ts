import type { Dashboard, EntryMutation, QueuedMutation } from './types'

// Mutations that fully rewrite one entity can be collapsed while still pending:
// only the latest payload matters and the queued item keeps its original
// expectedVersion so the optimistic version chain stays valid.
function coalesceKey(mutation: EntryMutation): string | null {
  if (mutation.type === 'upsert-routine')
    return `routine:${mutation.profileId}:${mutation.routineId}`
  if (mutation.type === 'upsert-routine-day')
    return `routine-day:${mutation.profileId}:${mutation.entryDate}`
  if (mutation.type === 'set-routine-weekday')
    return `routine-weekday:${mutation.profileId}:${mutation.weekday}`
  return null
}

export function mergePendingMutation(
  queue: QueuedMutation[],
  mutation: EntryMutation,
  isInFlight: (mutationId: string) => boolean
): QueuedMutation[] | null {
  const key = coalesceKey(mutation)
  if (!key) return null
  let index = -1
  for (let i = queue.length - 1; i >= 0; i -= 1) {
    const queued = queue[i]
    if (
      queued.status === 'pending' &&
      !isInFlight(queued.mutation.id) &&
      coalesceKey(queued.mutation) === key
    ) {
      index = i
      break
    }
  }
  if (index < 0) return null
  const queued = queue[index]
  const merged = { ...mutation, id: queued.mutation.id } as EntryMutation
  if ('expectedVersion' in queued.mutation && 'expectedVersion' in merged)
    merged.expectedVersion = queued.mutation.expectedVersion
  const next = queue.slice()
  next[index] = { ...queued, mutation: merged }
  return next
}

export function applyMutationLocally(dashboard: Dashboard, mutation: EntryMutation): Dashboard {
  if (mutation.type === 'upsert-meal') {
    const index = dashboard.mealEntries.findIndex(
      (entry) =>
        entry.profileId === mutation.profileId &&
        entry.mealSlotId === mutation.mealSlotId &&
        entry.entryDate === mutation.entryDate,
    )
    const entries = dashboard.mealEntries.slice()
    if (index >= 0) {
      entries[index] = { ...entries[index], status: mutation.status, version: entries[index].version + 1 }
    } else {
      entries.push({
        id: `local-${mutation.id}`,
        profileId: mutation.profileId,
        mealSlotId: mutation.mealSlotId,
        entryDate: mutation.entryDate,
        status: mutation.status,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
    return { ...dashboard, mealEntries: entries }
  }

  if (mutation.type === 'clear-meal') {
    return {
      ...dashboard,
      mealEntries: dashboard.mealEntries.filter(
        (entry) =>
          !(
            entry.profileId === mutation.profileId &&
            entry.mealSlotId === mutation.mealSlotId &&
            entry.entryDate === mutation.entryDate
          ),
      ),
    }
  }

  if (mutation.type === 'upsert-workout') {
    const index = dashboard.workoutEntries.findIndex(
      (entry) => entry.profileId === mutation.profileId && entry.entryDate === mutation.entryDate,
    )
    const entries = dashboard.workoutEntries.slice()
    if (index >= 0) {
      entries[index] = {
        ...entries[index],
        workoutType: mutation.workoutType,
        note: mutation.note,
        version: entries[index].version + 1,
      }
    } else {
      entries.push({
        id: `local-${mutation.id}`,
        profileId: mutation.profileId,
        entryDate: mutation.entryDate,
        workoutType: mutation.workoutType,
        note: mutation.note,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
    return { ...dashboard, workoutEntries: entries }
  }

  if (mutation.type === 'clear-workout') {
    return {
      ...dashboard,
      workoutEntries: dashboard.workoutEntries.filter(
        (entry) => !(entry.profileId === mutation.profileId && entry.entryDate === mutation.entryDate),
      ),
    }
  }

  if (mutation.type === 'upsert-free') {
    const index = dashboard.freeMealEntries.findIndex(
      (entry) => entry.profileId === mutation.profileId && entry.entryDate === mutation.entryDate,
    )
    const entries = dashboard.freeMealEntries.slice()
    if (index >= 0) {
      entries[index] = {
        ...entries[index],
        count: mutation.count,
        note: mutation.note,
        version: entries[index].version + 1,
      }
    } else {
      entries.push({
        id: `local-${mutation.id}`,
        profileId: mutation.profileId,
        entryDate: mutation.entryDate,
        count: mutation.count,
        note: mutation.note,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
    return { ...dashboard, freeMealEntries: entries }
  }

  if (mutation.type === 'clear-free') {
    return {
      ...dashboard,
      freeMealEntries: dashboard.freeMealEntries.filter(
        (entry) => !(entry.profileId === mutation.profileId && entry.entryDate === mutation.entryDate),
      ),
    }
  }

  if (mutation.type === 'upsert-extra') {
    const index = dashboard.extraEntries.findIndex(
      (entry) => entry.profileId === mutation.profileId && entry.entryDate === mutation.entryDate,
    )
    const entries = dashboard.extraEntries.slice()
    if (index >= 0) {
      entries[index] = {
        ...entries[index],
        level: mutation.level,
        note: mutation.note,
        version: entries[index].version + 1,
      }
    } else {
      entries.push({
        id: `local-${mutation.id}`,
        profileId: mutation.profileId,
        entryDate: mutation.entryDate,
        level: mutation.level,
        note: mutation.note,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
    return { ...dashboard, extraEntries: entries }
  }

  if (mutation.type === 'clear-extra') {
    return {
      ...dashboard,
      extraEntries: dashboard.extraEntries.filter(
        (entry) => !(entry.profileId === mutation.profileId && entry.entryDate === mutation.entryDate),
      ),
    }
  }

  if (mutation.type === 'upsert-routine') {
    const index = dashboard.routines.findIndex(
      (routine) => routine.id === mutation.routineId,
    )
    const routines = dashboard.routines.slice()
    if (index >= 0) {
      routines[index] = {
        ...routines[index],
        name: mutation.name,
        exercises: mutation.exercises,
        version: routines[index].version + 1,
      }
    } else {
      routines.push({
        id: mutation.routineId ?? `local-${mutation.id}`,
        name: mutation.name,
        position: routines.length,
        version: 1,
        exercises: mutation.exercises,
      })
    }
    return { ...dashboard, routines }
  }

  if (mutation.type === 'delete-routine') {
    return {
      ...dashboard,
      routines: dashboard.routines.filter(
        (routine) => routine.id !== mutation.routineId,
      ),
      routineSchedule: dashboard.routineSchedule.map((assigned) =>
        assigned === mutation.routineId ? null : assigned,
      ),
      routineDays: dashboard.routineDays.map((day) =>
        day.routineId === mutation.routineId ? { ...day, routineId: null } : day,
      ),
    }
  }

  if (mutation.type === 'set-routine-weekday') {
    const routineSchedule = dashboard.routineSchedule.map((assigned, index) =>
      index === mutation.weekday ? mutation.routineId : assigned,
    )
    return { ...dashboard, routineSchedule }
  }

  if (mutation.type === 'upsert-routine-day') {
    const index = dashboard.routineDays.findIndex(
      (day) =>
        day.profileId === mutation.profileId && day.entryDate === mutation.entryDate,
    )
    const routineDays = dashboard.routineDays.slice()
    if (index >= 0) {
      routineDays[index] = {
        ...routineDays[index],
        routineId: mutation.routineId,
        exercises: mutation.exercises,
        completed: mutation.completed,
        version: routineDays[index].version + 1,
      }
    } else {
      routineDays.push({
        id: `local-${mutation.id}`,
        profileId: mutation.profileId,
        entryDate: mutation.entryDate,
        routineId: mutation.routineId,
        exercises: mutation.exercises,
        completed: mutation.completed,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
    return { ...dashboard, routineDays }
  }

  if (mutation.type === 'clear-routine-day') {
    return {
      ...dashboard,
      routineDays: dashboard.routineDays.filter(
        (day) =>
          !(day.profileId === mutation.profileId && day.entryDate === mutation.entryDate),
      ),
    }
  }

  return dashboard
}
