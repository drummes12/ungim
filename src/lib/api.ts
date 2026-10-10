import type { EmailOtpType, SupabaseClient } from '@supabase/supabase-js'
import { addDays, isoWeekStart, monthEnd, todayInTimezone } from './dates'
import { applyMutationLocally } from './mutations'
import { computeMonthScore } from './scoring'
import type {
  AuthLinkInput,
  BackendApi,
  Competition,
  CompetitionMemberStatus,
  Dashboard,
  EntryMutation,
  ExtraEntry,
  FreeMealEntry,
  MealEntry,
  MonthRecord,
  PlanInput,
  Profile,
  RoutineDay,
  RoutineDayExercise,
  RoutineExercise,
  RoutineTemplate,
  WorkoutEntry
} from './types'

function text(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '')
}

function normalizeMonth(
  competitionId: string,
  month: Record<string, unknown>
): MonthRecord {
  return {
    competitionId: text(month.competitionId ?? month.competition_id) ||
      competitionId,
    monthKey: text(month.monthKey ?? month.month_key),
    confirmedBy:
      ((month.confirmedBy ?? month.confirmed_by) as string[]) ?? [],
    closedAt: (month.closedAt ?? month.closed_at) as string | null,
    result: month.result as MonthRecord['result'],
    createdAt: text(month.createdAt ?? month.created_at),
    updatedAt: text(month.updatedAt ?? month.updated_at)
  }
}

// Personal-view settings derived from the caller's active Cumbres: the first
// group's timezone and the earliest start date across groups.
function deriveSettings(competitions: Competition[], profileId: string) {
  const active = competitions.filter((competition) =>
    competition.members.some(
      (member) => member.profileId === profileId && member.status === 'active'
    )
  )
  if (!active.length) return null
  const starts = active
    .map((competition) => competition.startsOn)
    .filter((start): start is string => Boolean(start))
    .sort()
  return {
    homeTimezone: active[0].homeTimezone,
    startsOn: starts[0] ?? null
  }
}

function normalizeDashboard(raw: Record<string, unknown>): Dashboard {
  const rawSettings = raw.settings as Record<string, unknown> | null
  const currentProfileId = text(raw.currentProfileId ?? raw.current_profile_id)
  const competitions: Competition[] = (
    (raw.competitions as Record<string, unknown>[]) ?? []
  ).map((competition) => ({
    id: text(competition.id),
    name: text(competition.name),
    inviteCode: text(competition.inviteCode ?? competition.invite_code),
    homeTimezone: text(competition.homeTimezone ?? competition.home_timezone),
    startsOn: (competition.startsOn ?? competition.starts_on) as
      | string
      | null,
    createdBy: text(competition.createdBy ?? competition.created_by),
    createdAt: text(competition.createdAt ?? competition.created_at),
    members: ((competition.members as Record<string, unknown>[]) ?? []).map(
      (member) => ({
        profileId: text(member.profileId ?? member.profile_id),
        status: text(member.status) as CompetitionMemberStatus,
        joinedAt: text(member.joinedAt ?? member.joined_at)
      })
    )
  }))
  const settings = rawSettings
    ? {
        homeTimezone: text(
          rawSettings.homeTimezone ?? rawSettings.home_timezone
        ),
        startsOn: (rawSettings.startsOn ?? rawSettings.starts_on) as
          | string
          | null
      }
    : deriveSettings(competitions, currentProfileId)
  return {
    currentProfileId,
    profiles: ((raw.profiles as Record<string, unknown>[]) ?? []).map(
      (profile) => ({
        id: text(profile.id),
        displayName: text(profile.displayName ?? profile.display_name),
        avatarColor: text(profile.avatarColor ?? profile.avatar_color),
        configuredAt: (profile.configuredAt ?? profile.configured_at) as
          | string
          | null,
        createdAt: text(profile.createdAt ?? profile.created_at)
      })
    ),
    settings,
    planVersions: (
      ((raw.planVersions ?? raw.plan_versions) as Record<string, unknown>[]) ??
      []
    ).map((plan) => ({
      id: text(plan.id),
      profileId: text(plan.profileId ?? plan.profile_id),
      effectiveWeekStart: text(
        plan.effectiveWeekStart ?? plan.effective_week_start
      ),
      workoutTarget: Number(plan.workoutTarget ?? plan.workout_target),
      freeMealsPerMonth: Number(
        plan.freeMealsPerMonth ?? plan.free_meals_per_month ?? 0
      ),
      createdAt: text(plan.createdAt ?? plan.created_at),
      meals: ((plan.meals as Record<string, unknown>[]) ?? []).map((meal) => ({
        id: text(meal.id),
        name: text(meal.name),
        rule: text(meal.rule),
        position: Number(meal.position)
      }))
    })),
    mealEntries: (
      ((raw.mealEntries ?? raw.meal_entries) as Record<string, unknown>[]) ?? []
    ).map((entry) => ({
      id: text(entry.id),
      profileId: text(entry.profileId ?? entry.profile_id),
      mealSlotId: text(entry.mealSlotId ?? entry.meal_slot_id),
      entryDate: text(entry.entryDate ?? entry.entry_date),
      status: text(entry.status) as MealEntry['status'],
      version: Number(entry.version),
      createdAt: text(entry.createdAt ?? entry.created_at),
      updatedAt: text(entry.updatedAt ?? entry.updated_at)
    })),
    workoutEntries: (
      ((raw.workoutEntries ?? raw.workout_entries) as Record<
        string,
        unknown
      >[]) ?? []
    ).map((entry) => ({
      id: text(entry.id),
      profileId: text(entry.profileId ?? entry.profile_id),
      entryDate: text(entry.entryDate ?? entry.entry_date),
      workoutType: (entry.workoutType ?? entry.workout_type) as string | null,
      note: entry.note as string | null,
      version: Number(entry.version),
      createdAt: text(entry.createdAt ?? entry.created_at),
      updatedAt: text(entry.updatedAt ?? entry.updated_at)
    })),
    freeMealEntries: (
      ((raw.freeMealEntries ?? raw.free_meal_entries) as Record<
        string,
        unknown
      >[]) ?? []
    ).map((entry) => ({
      id: text(entry.id),
      profileId: text(entry.profileId ?? entry.profile_id),
      entryDate: text(entry.entryDate ?? entry.entry_date),
      count: Number(entry.count),
      note: (entry.note as string | null) ?? null,
      version: Number(entry.version),
      createdAt: text(entry.createdAt ?? entry.created_at),
      updatedAt: text(entry.updatedAt ?? entry.updated_at)
    })),
    extraEntries: (
      ((raw.extraEntries ?? raw.extra_entries) as Record<
        string,
        unknown
      >[]) ?? []
    ).map((entry) => ({
      id: text(entry.id),
      profileId: text(entry.profileId ?? entry.profile_id),
      entryDate: text(entry.entryDate ?? entry.entry_date),
      level: Number(entry.level) as ExtraEntry['level'],
      note: (entry.note as string | null) ?? null,
      version: Number(entry.version),
      createdAt: text(entry.createdAt ?? entry.created_at),
      updatedAt: text(entry.updatedAt ?? entry.updated_at)
    })),
    routines: (((raw.routines as Record<string, unknown>[]) ?? []).map(
      (routine) => ({
        id: text(routine.id),
        name: text(routine.name),
        position: Number(routine.position),
        version: Number(routine.version),
        exercises: (
          (routine.exercises as Record<string, unknown>[]) ?? []
        ).map(
          (exercise): RoutineExercise => ({
            name: text(exercise.name),
            sets: Number(exercise.sets),
            reps: Number(exercise.reps),
            weight: Number(exercise.weight)
          })
        )
      })
    ) satisfies RoutineTemplate[]),
    routineSchedule: (() => {
      const schedule = (raw.routineSchedule ?? raw.routine_schedule ?? {}) as
        | Record<string, string>
        | (string | null)[]
      return Array.from({ length: 7 }, (_, index) =>
        Array.isArray(schedule)
          ? (schedule[index] ?? null)
          : (schedule[String(index)] ?? null)
      )
    })(),
    routineDays: (
      ((raw.routineDays ?? raw.routine_days) as Record<
        string,
        unknown
      >[]) ?? []
    ).map(
      (day): RoutineDay => ({
        id: text(day.id),
        profileId: text(day.profileId ?? day.profile_id),
        entryDate: text(day.entryDate ?? day.entry_date),
        routineId: (day.routineId ?? day.routine_id) as string | null,
        exercises: (day.exercises as RoutineDayExercise[]) ?? [],
        completed: Boolean(day.completed),
        version: Number(day.version),
        createdAt: text(day.createdAt ?? day.created_at),
        updatedAt: text(day.updatedAt ?? day.updated_at)
      })
    ),
    competitions,
    months: Object.fromEntries(
      Object.entries(
        (raw.months as Record<
          string,
          Record<string, Record<string, unknown>>
        >) ?? {}
      ).map(([competitionId, compMonths]) => [
        competitionId,
        Object.fromEntries(
          Object.entries(compMonths).map(([key, month]) => [
            key,
            normalizeMonth(competitionId, month)
          ])
        )
      ])
    )
  }
}

// Returns a dashboard scoped to one Cumbre: only its active members, their
// entries and that group's months. Scoring code runs unchanged per group.
export function scopeDashboard(
  dashboard: Dashboard,
  competitionId: string
): Dashboard {
  const competition = dashboard.competitions.find(
    (item) => item.id === competitionId
  )
  if (!competition) return dashboard
  const active = competition.members.filter(
    (member) => member.status === 'active'
  )
  const memberIds = new Set(active.map((member) => member.profileId))
  const joinedAt = new Map(
    competition.members.map((member) => [member.profileId, member.joinedAt])
  )
  const keep = <T extends { profileId: string }>(items: T[]): T[] =>
    items.filter((item) => memberIds.has(item.profileId))
  return {
    ...dashboard,
    profiles: dashboard.profiles
      .filter((profile) => memberIds.has(profile.id))
      .map((profile) => ({ ...profile, joinedAt: joinedAt.get(profile.id) })),
    settings: {
      homeTimezone: competition.homeTimezone,
      startsOn: competition.startsOn
    },
    planVersions: keep(dashboard.planVersions),
    mealEntries: keep(dashboard.mealEntries),
    workoutEntries: keep(dashboard.workoutEntries),
    freeMealEntries: keep(dashboard.freeMealEntries),
    extraEntries: keep(dashboard.extraEntries),
    routineDays: keep(dashboard.routineDays),
    months: { [competitionId]: dashboard.months[competitionId] ?? {} }
  }
}

class SupabaseBackend implements BackendApi {
  private clientPromise: Promise<SupabaseClient> | null = null

  constructor(
    private url: string,
    private anonKey: string
  ) {}

  private client(): Promise<SupabaseClient> {
    this.clientPromise ??= import('@supabase/supabase-js').then(
      ({ createClient }) =>
        createClient(this.url, this.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true }
        })
    )
    return this.clientPromise
  }

  async signIn(email: string, password: string): Promise<void> {
    const client = await this.client()
    const { error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async requestPasswordReset(email: string): Promise<void> {
    const client = await this.client()
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    })
    if (error) throw error
  }

  async completeAuthLink(input: AuthLinkInput): Promise<string> {
    const client = await this.client()
    const { data, error } = await client.auth.verifyOtp({
      token_hash: input.tokenHash,
      type: input.type as EmailOtpType
    })
    if (error) throw error
    const userId = data.user?.id ?? data.session?.user.id
    if (!userId) throw new Error('El enlace no trajo una sesión válida.')
    if (input.password) {
      const { error: updateError } = await client.auth.updateUser({
        password: input.password
      })
      if (updateError) throw updateError
    }
    return userId
  }

  async signOut(): Promise<void> {
    const client = await this.client()
    const { error } = await client.auth.signOut()
    if (error) throw error
  }

  async getSessionProfileId(): Promise<string | null> {
    const client = await this.client()
    const { data } = await client.auth.getSession()
    return data.session?.user.id ?? null
  }

  async loadDashboard(): Promise<Dashboard> {
    const client = await this.client()
    const { data, error } = await client.rpc('get_dashboard')
    if (error) throw error
    return normalizeDashboard(data as Record<string, unknown>)
  }

  async applyMutation(mutation: EntryMutation): Promise<Dashboard> {
    const client = await this.client()
    const common = { p_mutation_id: mutation.id }
    const rpc =
      mutation.type === 'upsert-meal'
        ? client.rpc('upsert_meal_entry', {
            ...common,
            p_entry_date: mutation.entryDate,
            p_meal_slot_id: mutation.mealSlotId,
            p_status: mutation.status,
            p_expected_version: mutation.expectedVersion
          })
        : mutation.type === 'clear-meal'
          ? client.rpc('clear_meal_entry', {
              ...common,
              p_entry_date: mutation.entryDate,
              p_meal_slot_id: mutation.mealSlotId,
              p_expected_version: mutation.expectedVersion
            })
          : mutation.type === 'upsert-workout'
            ? client.rpc('upsert_workout_entry', {
                ...common,
                p_entry_date: mutation.entryDate,
                p_workout_type: mutation.workoutType,
                p_note: mutation.note,
                p_expected_version: mutation.expectedVersion
              })
            : mutation.type === 'clear-workout'
              ? client.rpc('clear_workout_entry', {
                  ...common,
                  p_entry_date: mutation.entryDate,
                  p_expected_version: mutation.expectedVersion
                })
              : mutation.type === 'upsert-free'
                ? client.rpc('upsert_free_meal_entry', {
                    ...common,
                    p_entry_date: mutation.entryDate,
                    p_count: mutation.count,
                    p_note: mutation.note,
                    p_expected_version: mutation.expectedVersion
                  })
                : mutation.type === 'clear-free'
                  ? client.rpc('clear_free_meal_entry', {
                      ...common,
                      p_entry_date: mutation.entryDate,
                      p_expected_version: mutation.expectedVersion
                    })
                  : mutation.type === 'upsert-extra'
                    ? client.rpc('upsert_extra_entry', {
                        ...common,
                        p_entry_date: mutation.entryDate,
                        p_level: mutation.level,
                        p_note: mutation.note,
                        p_expected_version: mutation.expectedVersion
                      })
                    : mutation.type === 'clear-extra'
                      ? client.rpc('clear_extra_entry', {
                          ...common,
                          p_entry_date: mutation.entryDate,
                          p_expected_version: mutation.expectedVersion
                        })
                      : mutation.type === 'upsert-routine'
                        ? client.rpc('upsert_routine', {
                            ...common,
                            p_routine_id: mutation.routineId,
                            p_name: mutation.name,
                            p_exercises: mutation.exercises,
                            p_expected_version: mutation.expectedVersion
                          })
                        : mutation.type === 'delete-routine'
                          ? client.rpc('delete_routine', {
                              ...common,
                              p_routine_id: mutation.routineId,
                              p_expected_version: mutation.expectedVersion
                            })
                          : mutation.type === 'set-routine-weekday'
                            ? client.rpc('set_routine_weekday', {
                                ...common,
                                p_weekday: mutation.weekday,
                                p_routine_id: mutation.routineId
                              })
                            : mutation.type === 'upsert-routine-day'
                              ? client.rpc('upsert_routine_day', {
                                  ...common,
                                  p_entry_date: mutation.entryDate,
                                  p_routine_id: mutation.routineId,
                                  p_exercises: mutation.exercises,
                                  p_completed: mutation.completed,
                                  p_expected_version: mutation.expectedVersion
                                })
                              : client.rpc('clear_routine_day', {
                                  ...common,
                                  p_entry_date: mutation.entryDate,
                                  p_expected_version: mutation.expectedVersion
                                })
    const { data, error } = await rpc
    if (error) throw error
    return normalizeDashboard(data as Record<string, unknown>)
  }

  async savePlan(mutationId: string, input: PlanInput): Promise<Dashboard> {
    const client = await this.client()
    const { data, error } = await client.rpc('save_plan', {
      p_mutation_id: mutationId,
      p_display_name: input.displayName,
      p_timezone: input.timezone,
      p_workout_target: input.workoutTarget,
      p_free_meals_per_month: input.freeMealsPerMonth,
      p_meals: input.meals
    })
    if (error) throw error
    return normalizeDashboard(data as Record<string, unknown>)
  }

  async confirmMonth(
    competitionId: string,
    monthKey: string
  ): Promise<MonthRecord> {
    const client = await this.client()
    const { data, error } = await client.rpc('confirm_month', {
      p_competition_id: competitionId,
      p_month_key: monthKey
    })
    if (error) throw error
    return normalizeMonth(
      competitionId,
      data as Record<string, unknown>
    )
  }

  private async rpcDashboard(
    name: string,
    params: Record<string, unknown>
  ): Promise<Dashboard> {
    const client = await this.client()
    const { data, error } = await client.rpc(name, params)
    if (error) throw error
    return normalizeDashboard(data as Record<string, unknown>)
  }

  createCompetition(
    mutationId: string,
    name: string,
    timezone: string
  ): Promise<Dashboard> {
    return this.rpcDashboard('create_competition', {
      p_mutation_id: mutationId,
      p_name: name,
      p_timezone: timezone
    })
  }

  joinCompetition(mutationId: string, code: string): Promise<Dashboard> {
    return this.rpcDashboard('join_competition', {
      p_mutation_id: mutationId,
      p_code: code
    })
  }

  leaveCompetition(
    mutationId: string,
    competitionId: string
  ): Promise<Dashboard> {
    return this.rpcDashboard('leave_competition', {
      p_mutation_id: mutationId,
      p_competition_id: competitionId
    })
  }

  regenerateInviteCode(
    mutationId: string,
    competitionId: string
  ): Promise<Dashboard> {
    return this.rpcDashboard('regenerate_invite_code', {
      p_mutation_id: mutationId,
      p_competition_id: competitionId
    })
  }

  subscribe(listener: () => void): () => void {
    let active = true
    let removeChannel: (() => Promise<unknown>) | null = null
    void this.client().then((client) => {
      if (!active) return
      const channel = client.channel('ungim-live')
      for (const table of [
        'profiles',
        'competitions',
        'competition_members',
        'plan_versions',
        'meal_slots',
        'meal_entries',
        'workout_entries',
        'free_meal_entries',
        'extra_entries',
        'routines',
        'routine_exercises',
        'routine_schedule',
        'routine_days',
        'months'
      ]) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          listener
        )
      }
      removeChannel = () => client.removeChannel(channel)
      channel.subscribe()
    })
    return () => {
      active = false
      void removeChannel?.()
    }
  }
}

const demoStorageKey = 'ungim-demo-dashboard-v2'
const demoSessionKey = 'ungim-demo-session-v1'
const demoUsers = new Map([
  ['ana@ungim.test', 'demo-ana'],
  ['leo@ungim.test', 'demo-leo'],
  ['max@ungim.test', 'demo-max']
])

function demoEntries(
  firstWeek: string,
  today: string
): Pick<
  Dashboard,
  | 'mealEntries'
  | 'workoutEntries'
  | 'freeMealEntries'
  | 'extraEntries'
  | 'routines'
  | 'routineSchedule'
  | 'routineDays'
> {
  const slots: Record<string, string[]> = {
    'demo-ana': ['meal-ana-1', 'meal-ana-2', 'meal-ana-3'],
    'demo-leo': ['meal-leo-1', 'meal-leo-2'],
    'demo-max': ['meal-max-1', 'meal-max-2']
  }
  const workoutDays: Record<string, number[]> = {
    'demo-ana': [0, 2, 3, 5],
    'demo-leo': [1, 3, 5],
    'demo-max': [1, 4]
  }
  const stamp = new Date().toISOString()
  const mealEntries: MealEntry[] = []
  const workoutEntries: WorkoutEntry[] = []
  const freeMealEntries: FreeMealEntry[] = []
  const extraEntries: ExtraEntry[] = []
  const routines: RoutineTemplate[] = [
    {
      id: 'routine-ana-pierna',
      name: 'Pierna',
      position: 0,
      version: 1,
      exercises: [
        { name: 'Sentadilla', sets: 4, reps: 8, weight: 60 },
        { name: 'Prensa', sets: 4, reps: 10, weight: 90 },
        { name: 'Extensión de cuádriceps', sets: 3, reps: 12, weight: 30 },
        { name: 'Peso muerto rumano', sets: 3, reps: 10, weight: 50 }
      ]
    },
    {
      id: 'routine-ana-pecho',
      name: 'Pecho y brazo',
      position: 1,
      version: 1,
      exercises: [
        { name: 'Press banca', sets: 4, reps: 8, weight: 40 },
        { name: 'Aperturas', sets: 3, reps: 12, weight: 10 },
        { name: 'Fondos', sets: 3, reps: 10, weight: 0 },
        { name: 'Curl bíceps', sets: 3, reps: 12, weight: 12 }
      ]
    }
  ]
  const routineSchedule: (string | null)[] = [
    'routine-ana-pierna',
    null,
    'routine-ana-pecho',
    null,
    'routine-ana-pierna',
    null,
    null
  ]
  const routineDays: RoutineDay[] = []
  let day = 0
  for (let date = firstWeek; date < today; date = addDays(date, 1), day += 1) {
    for (const [profileId, ids] of Object.entries(slots)) {
      const strong = profileId === 'demo-ana'
      ids.forEach((mealSlotId, index) => {
        const roll = (day * 7 + index * 3 + (strong ? 1 : 4)) % 10
        if (roll >= (strong ? 9 : 8)) return
        mealEntries.push({
          id: `demo-${profileId}-${mealSlotId}-${date}`,
          profileId,
          mealSlotId,
          entryDate: date,
          status: roll < (strong ? 8 : 6) ? 'met' : 'missed',
          version: 1,
          createdAt: stamp,
          updatedAt: stamp
        })
      })
      if (workoutDays[profileId].includes(day % 7))
        workoutEntries.push({
          id: `demo-${profileId}-workout-${date}`,
          profileId,
          entryDate: date,
          workoutType: null,
          note: null,
          version: 1,
          createdAt: stamp,
          updatedAt: stamp
        })
      if ((profileId === 'demo-ana' || profileId === 'demo-max') && day % 10 === 4)
        freeMealEntries.push({
          id: `demo-${profileId}-free-${date}`,
          profileId,
          entryDate: date,
          count: 1,
          note: day % 20 === 4 ? 'Helado' : null,
          version: 1,
          createdAt: stamp,
          updatedAt: stamp
        })
    }
  }
  return {
    mealEntries,
    workoutEntries,
    freeMealEntries,
    extraEntries,
    routines,
    routineSchedule,
    routineDays
  }
}

class DemoBackend implements BackendApi {
  private load(): Dashboard {
    const stored = localStorage.getItem(demoStorageKey)
    if (stored)
      return normalizeDashboard(JSON.parse(stored) as Record<string, unknown>)
    const seeded = this.seed()
    localStorage.setItem(demoStorageKey, JSON.stringify(seeded))
    return seeded
  }

  private save(dashboard: Dashboard): Dashboard {
    localStorage.setItem(demoStorageKey, JSON.stringify(dashboard))
    return dashboard
  }

  private seed(): Dashboard {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const today = todayInTimezone(timezone)
    const firstWeek = addDays(isoWeekStart(today), -21)
    const profiles: Profile[] = [
      {
        id: 'demo-ana',
        displayName: 'Ana',
        avatarColor: '#ff9078',
        configuredAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      },
      {
        id: 'demo-leo',
        displayName: 'Leo',
        avatarColor: '#557fd8',
        configuredAt: new Date().toISOString(),
        createdAt: new Date(Date.now() + 1).toISOString()
      },
      {
        id: 'demo-max',
        displayName: 'Max',
        avatarColor: '#3a9d6e',
        configuredAt: new Date().toISOString(),
        createdAt: new Date(Date.now() + 2).toISOString()
      }
    ]
    const competitions: Competition[] = [
      {
        id: 'demo-comp-pareja',
        name: 'Primera Cumbre',
        inviteCode: 'POWER1',
        homeTimezone: timezone,
        startsOn: firstWeek,
        createdBy: 'demo-ana',
        createdAt: new Date().toISOString(),
        members: [
          {
            profileId: 'demo-ana',
            status: 'active',
            joinedAt: '1970-01-01T00:00:00.000Z'
          },
          {
            profileId: 'demo-leo',
            status: 'active',
            joinedAt: '1970-01-01T00:00:00.000Z'
          }
        ]
      },
      {
        id: 'demo-comp-amigos',
        name: 'Amigos del Gim',
        inviteCode: 'DUFF21',
        homeTimezone: timezone,
        startsOn: firstWeek,
        createdBy: 'demo-leo',
        createdAt: new Date().toISOString(),
        members: [
          {
            profileId: 'demo-leo',
            status: 'active',
            joinedAt: '1970-01-01T00:00:00.000Z'
          },
          {
            profileId: 'demo-max',
            status: 'active',
            joinedAt: '1970-01-01T00:00:00.000Z'
          }
        ]
      }
    ]
    return {
      currentProfileId: 'demo-ana',
      profiles,
      settings: { homeTimezone: timezone, startsOn: firstWeek },
      competitions,
      planVersions: [
        {
          id: 'plan-ana',
          profileId: 'demo-ana',
          effectiveWeekStart: firstWeek,
          workoutTarget: 4,
          freeMealsPerMonth: 4,
          createdAt: new Date().toISOString(),
          meals: [
            {
              id: 'meal-ana-1',
              name: 'Desayuno',
              rule: 'Proteína y fruta',
              position: 1
            },
            {
              id: 'meal-ana-2',
              name: 'Comida',
              rule: 'Plato del plan',
              position: 2
            },
            {
              id: 'meal-ana-3',
              name: 'Cena',
              rule: 'Ligera y sin antojo',
              position: 3
            }
          ]
        },
        {
          id: 'plan-leo',
          profileId: 'demo-leo',
          effectiveWeekStart: firstWeek,
          workoutTarget: 3,
          freeMealsPerMonth: 0,
          createdAt: new Date().toISOString(),
          meals: [
            {
              id: 'meal-leo-1',
              name: 'Desayuno',
              rule: 'Café con proteína',
              position: 1
            },
            {
              id: 'meal-leo-2',
              name: 'Comida',
              rule: 'Porción del plan',
              position: 2
            }
          ]
        },
        {
          id: 'plan-max',
          profileId: 'demo-max',
          effectiveWeekStart: firstWeek,
          workoutTarget: 2,
          freeMealsPerMonth: 2,
          createdAt: new Date().toISOString(),
          meals: [
            {
              id: 'meal-max-1',
              name: 'Desayuno',
              rule: 'Avena y huevo',
              position: 1
            },
            {
              id: 'meal-max-2',
              name: 'Comida',
              rule: 'Sin ultraprocesados',
              position: 2
            }
          ]
        }
      ],
      ...demoEntries(firstWeek, today),
      months: {}
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    if (password !== 'donuts' || !demoUsers.has(email.toLowerCase())) {
      throw new Error(
        'Usa ana@ungim.test o leo@ungim.test con contraseña donuts.'
      )
    }
    localStorage.setItem(
      demoSessionKey,
      demoUsers.get(email.toLowerCase()) ?? ''
    )
  }

  async requestPasswordReset(): Promise<void> {
    throw new Error('El demo no envía correos. Usa contraseña donuts.')
  }

  async completeAuthLink(): Promise<string> {
    throw new Error('El demo no usa enlaces de acceso.')
  }

  async signOut(): Promise<void> {
    localStorage.removeItem(demoSessionKey)
  }

  async getSessionProfileId(): Promise<string | null> {
    return localStorage.getItem(demoSessionKey)
  }

  // Mirrors the RLS rules: the caller sees profiles sharing any Cumbre and
  // entries only from members sharing an active Cumbre.
  private withSession(dashboard: Dashboard): Dashboard {
    const profileId = localStorage.getItem(demoSessionKey)
    const uid = profileId ?? dashboard.currentProfileId
    const mine = dashboard.competitions.filter((competition) =>
      competition.members.some((member) => member.profileId === uid)
    )
    const profileVisible = new Set([uid])
    const entryVisible = new Set([uid])
    for (const competition of mine) {
      const me = competition.members.find(
        (member) => member.profileId === uid
      )
      for (const member of competition.members) {
        profileVisible.add(member.profileId)
        if (me?.status === 'active' && member.status === 'active')
          entryVisible.add(member.profileId)
      }
    }
    const keep = <T extends { profileId: string }>(items: T[]): T[] =>
      items.filter((item) => entryVisible.has(item.profileId))
    const myCompIds = new Set(mine.map((competition) => competition.id))
    return {
      ...dashboard,
      currentProfileId: uid,
      profiles: dashboard.profiles.filter((profile) =>
        profileVisible.has(profile.id)
      ),
      competitions: mine,
      planVersions: keep(dashboard.planVersions),
      mealEntries: keep(dashboard.mealEntries),
      workoutEntries: keep(dashboard.workoutEntries),
      freeMealEntries: keep(dashboard.freeMealEntries),
      extraEntries: keep(dashboard.extraEntries),
      routineDays: keep(dashboard.routineDays),
      settings: deriveSettings(mine, uid),
      months: Object.fromEntries(
        Object.entries(dashboard.months).filter(([competitionId]) =>
          myCompIds.has(competitionId)
        )
      )
    }
  }

  async loadDashboard(): Promise<Dashboard> {
    return this.withSession(this.load())
  }

  async applyMutation(mutation: EntryMutation): Promise<Dashboard> {
    return this.withSession(
      this.save(applyMutationLocally(this.load(), mutation))
    )
  }

  async savePlan(mutationId: string, input: PlanInput): Promise<Dashboard> {
    const dashboard = this.load()
    const profileId =
      localStorage.getItem(demoSessionKey) ?? dashboard.currentProfileId
    const hasPlan = dashboard.planVersions.some(
      (plan) => plan.profileId === profileId
    )
    const week = addDays(
      isoWeekStart(todayInTimezone(dashboard.settings?.homeTimezone ?? 'UTC')),
      hasPlan ? 7 : 0
    )
    const version = {
      id: `plan-${mutationId}`,
      profileId,
      effectiveWeekStart: week,
      workoutTarget: input.workoutTarget,
      freeMealsPerMonth: input.freeMealsPerMonth,
      createdAt: new Date().toISOString(),
      meals: input.meals.map((meal, index) => ({
        ...meal,
        id: `${mutationId}-${index + 1}`,
        position: index + 1
      }))
    }
    const saved = this.save({
      ...dashboard,
      profiles: dashboard.profiles.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              displayName: input.displayName,
              configuredAt: profile.configuredAt ?? new Date().toISOString()
            }
          : profile
      ),
      planVersions: [
        ...dashboard.planVersions.filter(
          (plan) =>
            !(plan.profileId === profileId && plan.effectiveWeekStart === week)
        ),
        version
      ],
      competitions: dashboard.competitions.map((competition) =>
        competition.startsOn ||
        !competition.members.every(
          (member) =>
            member.status !== 'active' ||
            (member.profileId === profileId
              ? true
              : dashboard.profiles.find(
                    (profile) => profile.id === member.profileId
                  )?.configuredAt)
        )
          ? competition
          : { ...competition, startsOn: todayInTimezone(input.timezone) }
      )
    })
    return this.withSession(saved)
  }

  async confirmMonth(
    competitionId: string,
    monthKey: string
  ): Promise<MonthRecord> {
    const dashboard = this.load()
    const profileId =
      localStorage.getItem(demoSessionKey) ?? dashboard.currentProfileId
    const competition = dashboard.competitions.find(
      (item) => item.id === competitionId
    )
    if (!competition) throw new Error('La Cumbre no existe.')
    const compMonths = dashboard.months[competitionId] ?? {}
    const previous = compMonths[monthKey]
    const confirmedBy = [
      ...new Set([...(previous?.confirmedBy ?? []), profileId])
    ]
    const activeCount = competition.members.filter(
      (member) => member.status === 'active'
    ).length
    const closed = confirmedBy.length >= activeCount
    const month: MonthRecord = {
      competitionId,
      monthKey,
      confirmedBy,
      closedAt: closed ? new Date().toISOString() : null,
      result: closed
        ? computeMonthScore(
            scopeDashboard(this.withSession(dashboard), competitionId),
            monthKey,
            monthEnd(monthKey)
          )
        : null,
      createdAt: previous?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    this.save({
      ...dashboard,
      months: {
        ...dashboard.months,
        [competitionId]: { ...compMonths, [monthKey]: month }
      }
    })
    return month
  }

  async createCompetition(
    mutationId: string,
    name: string,
    timezone: string
  ): Promise<Dashboard> {
    const dashboard = this.load()
    const profileId =
      localStorage.getItem(demoSessionKey) ?? dashboard.currentProfileId
    const me = dashboard.profiles.find((profile) => profile.id === profileId)
    const myMemberships = dashboard.competitions.filter((item) =>
      item.members.some((member) => member.profileId === profileId)
    ).length
    if (myMemberships >= 3) throw new Error('competition_limit')
    const competition: Competition = {
      id: `comp-${mutationId}`,
      name: name.trim(),
      inviteCode: demoInviteCode(),
      homeTimezone: timezone,
      startsOn: me?.configuredAt ? todayInTimezone(timezone) : null,
      createdBy: profileId,
      createdAt: new Date().toISOString(),
      members: [
        { profileId, status: 'active', joinedAt: new Date().toISOString() }
      ]
    }
    return this.withSession(
      this.save({
        ...dashboard,
        competitions: [...dashboard.competitions, competition]
      })
    )
  }

  async joinCompetition(
    mutationId: string,
    code: string
  ): Promise<Dashboard> {
    const dashboard = this.load()
    const profileId =
      localStorage.getItem(demoSessionKey) ?? dashboard.currentProfileId
    const competition = dashboard.competitions.find(
      (item) => item.inviteCode === code.trim().toUpperCase()
    )
    if (!competition) throw new Error('invite_code_invalid')
    if (
      competition.members.some((member) => member.profileId === profileId)
    )
      return this.withSession(dashboard)
    if (competition.members.length >= 5)
      throw new Error('competition_full')
    if (
      dashboard.competitions.filter((item) =>
        item.members.some((member) => member.profileId === profileId)
      ).length >= 3
    )
      throw new Error('competition_limit')
    void mutationId
    const me = dashboard.profiles.find((profile) => profile.id === profileId)
    const updated = {
      ...competition,
      members: [
        ...competition.members,
        { profileId, status: 'active' as const, joinedAt: new Date().toISOString() }
      ],
      startsOn:
        competition.startsOn ??
        (me?.configuredAt
          ? todayInTimezone(competition.homeTimezone)
          : null)
    }
    return this.withSession(
      this.save({
        ...dashboard,
        competitions: dashboard.competitions.map((item) =>
          item.id === competition.id ? updated : item
        )
      })
    )
  }

  async leaveCompetition(
    mutationId: string,
    competitionId: string
  ): Promise<Dashboard> {
    const dashboard = this.load()
    const profileId =
      localStorage.getItem(demoSessionKey) ?? dashboard.currentProfileId
    void mutationId
    const competitions = dashboard.competitions
      .map((competition) =>
        competition.id === competitionId
          ? {
              ...competition,
              members: competition.members.filter(
                (member) => member.profileId !== profileId
              )
            }
          : competition
      )
      .filter((competition) => competition.members.length > 0)
    return this.withSession(this.save({ ...dashboard, competitions }))
  }

  async regenerateInviteCode(
    mutationId: string,
    competitionId: string
  ): Promise<Dashboard> {
    const dashboard = this.load()
    void mutationId
    return this.withSession(
      this.save({
        ...dashboard,
        competitions: dashboard.competitions.map((competition) =>
          competition.id === competitionId
            ? { ...competition, inviteCode: demoInviteCode() }
            : competition
        )
      })
    )
  }
}

function demoInviteCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from(
    { length: 6 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)]
  ).join('')
}

export function createBackend(): BackendApi {
  if (import.meta.env.VITE_DEMO_MODE === 'true') return new DemoBackend()
  const url = import.meta.env.VITE_SUPABASE_URL
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !publishableKey) {
    throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.')
  }
  return new SupabaseBackend(url, publishableKey)
}

export const demoModeEnabled = import.meta.env.VITE_DEMO_MODE === 'true'
