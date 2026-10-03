import { openDB, type IDBPDatabase } from 'idb'
import type { Dashboard, QueuedMutation } from './types'

const databaseName = 'ungim-offline'

type UngimDb = IDBPDatabase<{
  snapshots: { key: string; value: Dashboard }
  queue: { key: string; value: QueuedMutation[] }
}>

let databasePromise: Promise<UngimDb> | null = null

function database(): Promise<UngimDb> {
  databasePromise ??= openDB(databaseName, 1, {
    upgrade(db) {
      db.createObjectStore('snapshots')
      db.createObjectStore('queue')
    }
  })
  return databasePromise
}

export async function saveDashboardSnapshot(
  profileId: string,
  dashboard: Dashboard
): Promise<void> {
  await (await database()).put('snapshots', dashboard, profileId)
}

export async function loadDashboardSnapshot(
  profileId: string
): Promise<Dashboard | null> {
  return (await (await database()).get('snapshots', profileId)) ?? null
}

export async function saveQueue(
  profileId: string,
  queue: QueuedMutation[]
): Promise<void> {
  await (await database()).put('queue', queue, profileId)
}

export async function loadQueue(profileId: string): Promise<QueuedMutation[]> {
  return (await (await database()).get('queue', profileId)) ?? []
}
