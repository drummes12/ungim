import type { Dashboard, EntryMutation } from './types'

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

  return {
    ...dashboard,
    workoutEntries: dashboard.workoutEntries.filter(
      (entry) => !(entry.profileId === mutation.profileId && entry.entryDate === mutation.entryDate),
    ),
  }
}
