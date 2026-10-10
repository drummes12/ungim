export type MealStatus = 'met' | 'missed'


export type ExtraLevel = 1 | 2 | 3

export interface Profile {
  id: string
  displayName: string
  avatarColor: string
  configuredAt: string | null
  createdAt: string
  // Set on competition-scoped dashboards: when this member joined the group.
  joinedAt?: string
}

export interface CompetitionSettings {
  homeTimezone: string
  startsOn: string | null
}

export type CompetitionMemberStatus = 'active' | 'paused'

export interface CompetitionMember {
  profileId: string
  status: CompetitionMemberStatus
  joinedAt: string
}

// A "Cumbre": a private competition group (max 5 members) joined by invite code.
export interface Competition {
  id: string
  name: string
  inviteCode: string
  homeTimezone: string
  startsOn: string | null
  createdBy: string
  createdAt: string
  members: CompetitionMember[]
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

export interface ExtraEntry {
  id: string
  profileId: string
  entryDate: string
  level: ExtraLevel
  note: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface RoutineExercise {
  name: string
  sets: number
  reps: number
  weight: number
}

export interface RoutineTemplate {
  id: string
  name: string
  position: number
  version: number
  exercises: RoutineExercise[]
}

export interface RoutineDayExercise extends RoutineExercise {
  id: number
  skipped: boolean
  done: boolean[]
  repsDone: number[]
}

export interface RoutineDay {
  id: string
  profileId: string
  entryDate: string
  routineId: string | null
  exercises: RoutineDayExercise[]
  completed: boolean
  version: number
  createdAt: string
  updatedAt: string
}

export interface MonthRecord {
  competitionId: string
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
  extraEntries: ExtraEntry[]
  routines: RoutineTemplate[]
  routineSchedule: (string | null)[]
  routineDays: RoutineDay[]
  competitions: Competition[]
  // competitionId -> monthKey -> record
  months: Record<string, Record<string, MonthRecord>>
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
  extraPoints: number
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
  | {
      id: string
      type: 'upsert-extra'
      profileId: string
      entryDate: string
      level: ExtraLevel
      note: string | null
      expectedVersion: number | null
    }
  | {
      id: string
      type: 'clear-extra'
      profileId: string
      entryDate: string
      expectedVersion: number | null
    }
  | {
      id: string
      type: 'upsert-routine'
      profileId: string
      routineId: string | null
      name: string
      exercises: RoutineExercise[]
      expectedVersion: number | null
    }
  | {
      id: string
      type: 'delete-routine'
      profileId: string
      routineId: string
      expectedVersion: number | null
    }
  | {
      id: string
      type: 'set-routine-weekday'
      profileId: string
      weekday: number
      routineId: string | null
    }
  | {
      id: string
      type: 'upsert-routine-day'
      profileId: string
      entryDate: string
      routineId: string | null
      exercises: RoutineDayExercise[]
      completed: boolean
      expectedVersion: number | null
    }
  | {
      id: string
      type: 'clear-routine-day'
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
  confirmMonth(competitionId: string, monthKey: string): Promise<MonthRecord>
  createCompetition(mutationId: string, name: string, timezone: string): Promise<Dashboard>
  joinCompetition(mutationId: string, code: string): Promise<Dashboard>
  leaveCompetition(mutationId: string, competitionId: string): Promise<Dashboard>
  regenerateInviteCode(mutationId: string, competitionId: string): Promise<Dashboard>
  subscribe?(listener: () => void): () => void
}
