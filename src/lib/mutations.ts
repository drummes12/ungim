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

  return dashboard
}
