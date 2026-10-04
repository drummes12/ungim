export type MealStatus = 'met' | 'missed'

export interface Profile {
  id: string
  displayName: string
  avatarColor: string
  configuredAt: string | null
  createdAt: string
}

export interface CompetitionSettings {
  homeTimezone: string
  startsOn: string | null
}

export interface MealSlot {
  id: string
  name: string
  rule: string
  position: number
}

export interface PlanVersion {
  id: string
  profileId: string
  effectiveWeekStart: string
  workoutTarget: number
  freeMealsPerMonth: number
  createdAt: string
  meals: MealSlot[]
}

export interface MealEntry {
  id: string
  profileId: string
  mealSlotId: string
  entryDate: string
  status: MealStatus
  version: number
  createdAt: string
  updatedAt: string
}

export interface WorkoutEntry {
  id: string
  profileId: string
  entryDate: string
  workoutType: string | null
  note: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface FreeMealEntry {
  id: string
  profileId: string
  entryDate: string
  count: number
  note: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface MonthRecord {
  monthKey: string
  confirmedBy: string[]
  closedAt: string | null
  result: MonthResult | null
  createdAt: string
  updatedAt: string
}

export interface Dashboard {
  currentProfileId: string
  profiles: Profile[]
  settings: CompetitionSettings | null
  planVersions: PlanVersion[]
  mealEntries: MealEntry[]
  workoutEntries: WorkoutEntry[]
  freeMealEntries: FreeMealEntry[]
  months: Record<string, MonthRecord>
}

export interface ParticipantScore {
  profileId: string
  name: string
  color: string
  noData: boolean
  base: number
  bonus: number
  total: number
  streak: number
  workout: { earned: number; target: number }
  meals: { met: number; planned: number }
  freeMeals: { used: number; quota: number }
}

export interface MonthResult {
  monthKey: string
  timezone: string
  participants: ParticipantScore[]
  winnerIds: string[]
  computedAt: string
}

export type EntryMutation =
  | {
      id: string
      type: 'upsert-meal'
      profileId: string
      entryDate: string
      mealSlotId: string
      status: MealStatus
      expectedVersion: number | null
    }
  | {
      id: string
      type: 'clear-meal'
      profileId: string
      entryDate: string
      mealSlotId: string
      expectedVersion: number | null
    }
  | {
      id: string
      type: 'upsert-workout'
      profileId: string
      entryDate: string
      workoutType: string | null
      note: string | null
      expectedVersion: number | null
    }
  | {
      id: string
      type: 'clear-workout'
      profileId: string
      entryDate: string
      expectedVersion: number | null
    }
  | {
      id: string
      type: 'upsert-free'
      profileId: string
      entryDate: string
      count: number
      note: string | null
      expectedVersion: number | null
    }
  | {
      id: string
      type: 'clear-free'
      profileId: string
      entryDate: string
      expectedVersion: number | null
    }

export interface QueuedMutation {
  mutation: EntryMutation
  status: 'pending' | 'error'
  error: string | null
  createdAt: string
}

export interface PlanInput {
  displayName: string
  timezone: string
  workoutTarget: number
  freeMealsPerMonth: number
  meals: Array<Pick<MealSlot, 'name' | 'rule'>>
}

export interface AuthLinkInput {
  tokenHash: string
  type: string
  password?: string
}

export interface BackendApi {
  signIn(email: string, password: string): Promise<void>
  requestPasswordReset(email: string): Promise<void>
  completeAuthLink(input: AuthLinkInput): Promise<string>
  signOut(): Promise<void>
  getSessionProfileId(): Promise<string | null>
  loadDashboard(): Promise<Dashboard>
  applyMutation(mutation: EntryMutation): Promise<Dashboard>
  savePlan(mutationId: string, input: PlanInput): Promise<Dashboard>
  confirmMonth(monthKey: string): Promise<MonthRecord>
  subscribe?(listener: () => void): () => void
}
