import type { EmailOtpType, SupabaseClient } from '@supabase/supabase-js'
import { addDays, isoWeekStart, monthEnd, todayInTimezone } from './dates'
import { applyMutationLocally } from './mutations'
import { computeMonthScore } from './scoring'
import type {
  AuthLinkInput,
  BackendApi,
  Dashboard,
  EntryMutation,
  MealEntry,
  MonthRecord,
  PlanInput,
  Profile,
  WorkoutEntry
} from './types'

function text(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '')
}

function normalizeDashboard(raw: Record<string, unknown>): Dashboard {
  const settings = raw.settings as Record<string, unknown> | null
  return {
    currentProfileId: text(raw.currentProfileId ?? raw.current_profile_id),
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
    settings: settings
      ? {
          homeTimezone: text(settings.homeTimezone ?? settings.home_timezone),
          startsOn: (settings.startsOn ?? settings.starts_on) as string | null
        }
      : null,
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
    months: Object.fromEntries(
      Object.entries(
        (raw.months as Record<string, Record<string, unknown>>) ?? {}
      ).map(([key, month]) => [
        key,
        {
          monthKey: text(month.monthKey ?? month.month_key),
          confirmedBy:
            ((month.confirmedBy ?? month.confirmed_by) as string[]) ?? [],
          closedAt: (month.closedAt ?? month.closed_at) as string | null,
          result: month.result as MonthRecord['result'],
          createdAt: text(month.createdAt ?? month.created_at),
          updatedAt: text(month.updatedAt ?? month.updated_at)
        } satisfies MonthRecord
      ])
    )
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
            : client.rpc('clear_workout_entry', {
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
      p_meals: input.meals
    })
    if (error) throw error
    return normalizeDashboard(data as Record<string, unknown>)
  }

  async confirmMonth(monthKey: string): Promise<MonthRecord> {
    const client = await this.client()
    const { data, error } = await client.rpc('confirm_month', {
      p_month_key: monthKey
    })
    if (error) throw error
    const month = data as Record<string, unknown>
    return {
      monthKey: text(month.monthKey ?? month.month_key),
      confirmedBy:
        ((month.confirmedBy ?? month.confirmed_by) as string[]) ?? [],
      closedAt: (month.closedAt ?? month.closed_at) as string | null,
      result: month.result as MonthRecord['result'],
      createdAt: text(month.createdAt ?? month.created_at),
      updatedAt: text(month.updatedAt ?? month.updated_at)
    }
  }

  subscribe(listener: () => void): () => void {
    let active = true
    let removeChannel: (() => Promise<unknown>) | null = null
    void this.client().then((client) => {
      if (!active) return
      const channel = client.channel('ungim-live')
      for (const table of [
        'profiles',
        'competition_settings',
        'plan_versions',
        'meal_slots',
        'meal_entries',
        'workout_entries',
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

const demoStorageKey = 'ungim-demo-dashboard-v1'
const demoSessionKey = 'ungim-demo-session-v1'
const demoUsers = new Map([
  ['ana@ungim.test', 'demo-ana'],
  ['leo@ungim.test', 'demo-leo']
])

function demoEntries(
  firstWeek: string,
  today: string
): Pick<Dashboard, 'mealEntries' | 'workoutEntries'> {
  const slots: Record<string, string[]> = {
    'demo-ana': ['meal-ana-1', 'meal-ana-2', 'meal-ana-3'],
    'demo-leo': ['meal-leo-1', 'meal-leo-2']
  }
  const workoutDays: Record<string, number[]> = {
    'demo-ana': [0, 2, 3, 5],
    'demo-leo': [1, 3, 5]
  }
  const stamp = new Date().toISOString()
  const mealEntries: MealEntry[] = []
  const workoutEntries: WorkoutEntry[] = []
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
    }
  }
  return { mealEntries, workoutEntries }
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
      }
    ]
    return {
      currentProfileId: 'demo-ana',
      profiles,
      settings: { homeTimezone: timezone, startsOn: firstWeek },
      planVersions: [
        {
          id: 'plan-ana',
          profileId: 'demo-ana',
          effectiveWeekStart: firstWeek,
          workoutTarget: 4,
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

  async loadDashboard(): Promise<Dashboard> {
    const dashboard = this.load()
    const profileId = localStorage.getItem(demoSessionKey)
    return {
      ...dashboard,
      currentProfileId: profileId ?? dashboard.currentProfileId
    }
  }

  async applyMutation(mutation: EntryMutation): Promise<Dashboard> {
    return this.save(applyMutationLocally(this.load(), mutation))
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
      createdAt: new Date().toISOString(),
      meals: input.meals.map((meal, index) => ({
        ...meal,
        id: `${mutationId}-${index + 1}`,
        position: index + 1
      }))
    }
    return this.save({
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
      settings: {
        homeTimezone: dashboard.settings?.homeTimezone ?? input.timezone,
        startsOn:
          dashboard.settings?.startsOn ?? todayInTimezone(input.timezone)
      }
    })
  }

  async confirmMonth(monthKey: string): Promise<MonthRecord> {
    const dashboard = this.load()
    const profileId =
      localStorage.getItem(demoSessionKey) ?? dashboard.currentProfileId
    const previous = dashboard.months[monthKey]
    const confirmedBy = [
      ...new Set([...(previous?.confirmedBy ?? []), profileId])
    ]
    const closed = confirmedBy.length === dashboard.profiles.length
    const month: MonthRecord = {
      monthKey,
      confirmedBy,
      closedAt: closed ? new Date().toISOString() : null,
      result: closed
        ? computeMonthScore(dashboard, monthKey, monthEnd(monthKey))
        : null,
      createdAt: previous?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    this.save({
      ...dashboard,
      months: { ...dashboard.months, [monthKey]: month }
    })
    return month
  }
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
