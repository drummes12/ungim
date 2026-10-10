import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createBackend, scopeDashboard } from './lib/api'
import {
  formatDay,
  formatMonth,
  monthKeyForDate,
  todayInTimezone
} from './lib/dates'
import {
  applyMutationLocally,
  expectedVersionFor,
  mergePendingMutation
} from './lib/mutations'
import { routineDayFor } from './lib/routines'
import {
  extraEntryFor,
  freeMealEntryFor,
  mealEntryFor,
  workoutForDate
} from './lib/scoring'
import {
  loadDashboardSnapshot,
  loadQueue,
  saveDashboardSnapshot,
  saveQueue
} from './lib/storage'
import type {
  AuthLinkInput,
  BackendApi,
  Dashboard,
  EntryMutation,
  ExtraLevel,
  MealSlot,
  MealStatus,
  PlanInput,
  QueuedMutation,
  RoutineDayExercise,
  RoutineExercise
} from './lib/types'
import { Avatar } from './components/Avatar'
import { DayEditor } from './components/DayEditor'
import { InstallHelp } from './components/PwaNotices'
import { Sheet } from './components/Sheet'
import { StatusPill } from './components/StatusPill'
import { Celebration } from './components/Celebration'
import { ShareSheet } from './components/ShareSheet'
import {
  AccountPanel,
  ConfirmMonthForm,
  HelpPanel,
  WorkoutDetailsForm
} from './components/sheets'
import {
  CompetitionSwitcher,
  CumbresPanel
} from './components/Competitions'
import { RoutinePanel } from './components/routine'
import {
  CalendarIcon,
  BrandIcon,
  CloudOffIcon,
  DonutIcon,
  HelpIcon,
  HomeIcon,
  TrophyIcon
} from './components/icons'
import { AuthLinkScreen } from './screens/AuthLinkScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { LoginScreen } from './screens/LoginScreen'
import { PlanScreen } from './screens/PlanScreen'
import { ScoreboardScreen } from './screens/ScoreboardScreen'
import { TodayScreen } from './screens/TodayScreen'
import type { ShareCardKind } from './components/ShareCard'

type Route = 'today' | 'score' | 'history'

function readAuthLink(): { tokenHash: string; type: string } | null {
  const params = new URLSearchParams(window.location.search)
  const tokenHash = params.get('token_hash')
  const type = params.get('type')
  return tokenHash && type ? { tokenHash, type } : null
}

function applyQueueToDashboard(
  dashboard: Dashboard,
  queue: QueuedMutation[]
): Dashboard {
  return queue
    .filter((item) => item.status === 'pending')
    .reduce(
      (current, item) => applyMutationLocally(current, item.mutation),
      dashboard
    )
}

function describeMutation(mutation: EntryMutation): string {
  if (mutation.type === 'upsert-routine')
    return `Rutina guardada · ${mutation.name}`
  if (mutation.type === 'delete-routine') return 'Rutina eliminada'
  if (mutation.type === 'set-routine-weekday')
    return `Rutina semanal · ${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][mutation.weekday]}`
  if (mutation.type === 'upsert-routine-day')
    return `Rutina del día · ${mutation.entryDate}`
  if (mutation.type === 'clear-routine-day')
    return `Rutina del día borrada · ${mutation.entryDate}`
  const kind = mutation.type.includes('extra')
    ? 'extra'
    : mutation.type.includes('free')
      ? 'free'
      : mutation.type.includes('workout')
        ? 'workout'
        : 'meal'
  const action =
    kind === 'extra'
      ? mutation.type === 'clear-extra'
        ? 'Actividad extra deshecha'
        : 'Actividad extra'
      : kind === 'free'
        ? mutation.type === 'clear-free'
          ? 'Comida libre deshecha'
          : 'Comida libre'
        : kind === 'workout'
          ? mutation.type === 'clear-workout'
            ? 'Entrenamiento deshecho'
            : 'Entrenamiento'
          : mutation.type === 'clear-meal'
            ? 'Comida desmarcada'
            : 'Comida'
  return `${action} · ${mutation.entryDate}`
}

function friendlySyncError(message: string): string {
  if (message.includes('revision_conflict'))
    return 'Otro dispositivo cambió este registro primero.'
  if (message.includes('month_already_closed'))
    return 'El mes ya se cerró y no acepta cambios.'
  if (message.includes('future_date_not_allowed'))
    return 'No se permiten fechas futuras.'
  if (message.includes('date_before_competition_start'))
    return 'La fecha es anterior al inicio de la competencia.'
  if (message.includes('invite_code_invalid'))
    return 'Esa barrita no existe. Revisa el código.'
  if (message.includes('competition_full'))
    return 'Esa Cumbre ya llegó al límite de 5 compañeros.'
  if (message.includes('competition_limit'))
    return 'Ya escalas el máximo de 3 Cumbres.'
  if (message.includes('not_a_competition_member'))
    return 'Ya no eres miembro de esa Cumbre.'
  if (message.includes('competition_not_found'))
    return 'Esa Cumbre ya no existe.'
  if (message.includes('invite_failed'))
    return 'No se pudo enviar la invitación.'
  return message
}

function competitionError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause)
  const friendly = friendlySyncError(message)
  return friendly === message ? 'Algo falló, inténtalo otra vez.' : friendly
}

export function App({ onReady }: { onReady?: () => void } = {}) {
  const backendState = useMemo<{
    api: BackendApi | null
    error: string | null
  }>(() => {
    try {
      return { api: createBackend(), error: null }
    } catch (cause) {
      return {
        api: null,
        error:
          cause instanceof Error ? cause.message : 'Configuración incompleta.'
      }
    }
  }, [])
  const backend = backendState.api
  const [profileId, setProfileId] = useState<string | null>(null)
  const [authLink, setAuthLink] = useState(readAuthLink)
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [queue, setQueue] = useState<QueuedMutation[]>([])
  const [online, setOnline] = useState(navigator.onLine)
  const [loading, setLoading] = useState(Boolean(backend))
  const [route, setRoute] = useState<Route>('today')
  const [planOpen, setPlanOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [celebrateKey, setCelebrateKey] = useState<string | null>(null)
  const [shareKind, setShareKind] = useState<ShareCardKind>('today')
  const [shareOpen, setShareOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [installOpen, setInstallOpen] = useState(false)
  const [daySheet, setDaySheet] = useState<string | null>(null)
  const [detailsDate, setDetailsDate] = useState<string | null>(null)
  const [routineDate, setRoutineDate] = useState<string | null>(null)
  const [closeMonthKey, setCloseMonthKey] = useState<string | null>(null)
  const [activeCompId, setActiveCompId] = useState<string | null>(null)
  const [cumbresOpen, setCumbresOpen] = useState(false)
  const [joinCode] = useState<string | null>(() => {
    const code = new URLSearchParams(window.location.search).get('join')
    if (!code) return null
    window.history.replaceState(null, '', window.location.pathname)
    return code
  })
  const queueRef = useRef(queue)
  const queueWriteRef = useRef(Promise.resolve())
  const dashboardRef = useRef(dashboard)
  const syncingRef = useRef(false)
  const inFlightRef = useRef(new Set<string>())
  const syncTimerRef = useRef<number | undefined>(undefined)
  const refreshTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!loading) onReady?.()
  }, [loading, onReady])

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    dashboardRef.current = dashboard
  }, [dashboard])

  const joinAttempted = useRef(false)
  useEffect(() => {
    if (!dashboard || !joinCode || joinAttempted.current) return
    joinAttempted.current = true
    if (dashboard.competitions.some((item) => item.inviteCode === joinCode))
      return
    void joinCompetition(joinCode).catch((cause) =>
      setNotice(
        cause instanceof Error
          ? cause.message
          : 'No se pudo unir a la Cumbre.'
      )
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- join once when the dashboard lands
  }, [dashboard, joinCode])

  const timezone =
    dashboard?.settings?.homeTimezone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    'UTC'
  const today = todayInTimezone(timezone)

  const updateQueue = useCallback(
    async (nextQueue: QueuedMutation[], userId: string) => {
      queueRef.current = nextQueue
      const write = queueWriteRef.current
        .then(() => saveQueue(userId, nextQueue))
        .then(
          () => undefined,
          () => undefined
        )
      queueWriteRef.current = write
      await write
      setQueue(queueRef.current)
    },
    []
  )

  const syncPending = useCallback(async () => {
    if (!backend || !profileId || !navigator.onLine || syncingRef.current)
      return
    syncingRef.current = true
    try {
      // Mutations already rebased onto fresh server state this pass; a second
      // revision_conflict is a real failure, not a stale version.
      const rebasedIds = new Set<string>()
      for (;;) {
        const item = queueRef.current.find(
          (queued) => queued.status === 'pending'
        )
        if (!item) break
        inFlightRef.current.add(item.mutation.id)
        try {
          const remote = await backend.applyMutation(item.mutation)
          const nextQueue = queueRef.current.filter(
            (queued) => queued.mutation.id !== item.mutation.id
          )
          const visible = applyQueueToDashboard(remote, nextQueue)
          dashboardRef.current = visible
          setDashboard(visible)
          await updateQueue(nextQueue, profileId)
          await saveDashboardSnapshot(profileId, remote).catch(() => undefined)
        } catch (cause) {
          const message =
            cause instanceof Error ? cause.message : 'No sincronizó'
          if (
            !rebasedIds.has(item.mutation.id) &&
            message.includes('revision_conflict')
          ) {
            // Rebase the stale expectedVersion onto the server's current row
            // version and let the loop retry the mutation once in place.
            rebasedIds.add(item.mutation.id)
            try {
              const remote = await backend.loadDashboard()
              let mutation = item.mutation
              if ('expectedVersion' in mutation) {
                mutation = {
                  ...mutation,
                  expectedVersion: expectedVersionFor(mutation, remote)
                }
              }
              const nextQueue = queueRef.current.map((queued) =>
                queued.mutation.id === item.mutation.id
                  ? { ...queued, mutation }
                  : queued
              )
              const visible = applyQueueToDashboard(remote, nextQueue)
              dashboardRef.current = visible
              setDashboard(visible)
              await saveDashboardSnapshot(profileId, remote).catch(
                () => undefined
              )
              await updateQueue(nextQueue, profileId)
              continue
            } catch {
              // fall through and mark the item as failed
            }
          }
          const nextQueue = queueRef.current.map((queued) =>
            queued.mutation.id === item.mutation.id
              ? {
                  ...queued,
                  status: 'error' as const,
                  error: message
                }
              : queued
          )
          await updateQueue(nextQueue, profileId)
          const snapshot = await loadDashboardSnapshot(profileId).catch(
            () => null
          )
          if (snapshot) {
            const visible = applyQueueToDashboard(snapshot, nextQueue)
            dashboardRef.current = visible
            setDashboard(visible)
          }
          setNotice('Un cambio quedó pendiente por revisar.')
          break
        } finally {
          inFlightRef.current.delete(item.mutation.id)
        }
      }
    } finally {
      syncingRef.current = false
    }
  }, [backend, profileId, updateQueue])

  const scheduleSync = useCallback(() => {
    window.clearTimeout(syncTimerRef.current)
    syncTimerRef.current = window.setTimeout(() => {
      if (navigator.onLine) void syncPending()
    }, 400)
  }, [syncPending])

  const refreshDashboard = useCallback(
    async (userId = profileId) => {
      if (!backend || !userId || !navigator.onLine) return
      const remote = await backend.loadDashboard()
      const visible = applyQueueToDashboard(remote, queueRef.current)
      dashboardRef.current = visible
      setDashboard(visible)
      await saveDashboardSnapshot(userId, remote).catch(() => undefined)
    },
    [backend, profileId]
  )

  useEffect(() => {
    if (!backend) return
    const api = backend
    let cancelled = false
    async function initialize() {
      try {
        const sessionProfileId = await api.getSessionProfileId()
        if (!sessionProfileId || cancelled) {
          setLoading(false)
          return
        }
        setProfileId(sessionProfileId)
        const [snapshot, savedQueue] = await Promise.all([
          loadDashboardSnapshot(sessionProfileId).catch(() => null),
          loadQueue(sessionProfileId).catch(() => [])
        ])
        queueRef.current = savedQueue
        setQueue(savedQueue)
        if (snapshot && !cancelled) {
          const visible = applyQueueToDashboard(snapshot, savedQueue)
          setDashboard(visible)
          dashboardRef.current = visible
        }
        if (navigator.onLine && !cancelled)
          await refreshDashboard(sessionProfileId)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void initialize()
    return () => {
      cancelled = true
    }
  }, [backend, refreshDashboard])

  useEffect(() => {
    const goOnline = () => {
      setOnline(true)
      void syncPending()
      void refreshDashboard()
    }
    const goOffline = () => setOnline(false)
    const visible = () => {
      if (document.visibilityState === 'visible') {
        void syncPending()
        void refreshDashboard()
      }
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [refreshDashboard, syncPending])

  useEffect(() => {
    if (!backend?.subscribe || !profileId) return
    return backend.subscribe(() => {
      if (!navigator.onLine) return
      window.clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = window.setTimeout(
        () => void refreshDashboard(),
        300
      )
    })
  }, [backend, profileId, refreshDashboard])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4200)
    return () => window.clearTimeout(timer)
  }, [notice])

  async function signIn(email: string, password: string) {
    if (!backend) return
    await backend.signIn(email, password)
    const userId = await backend.getSessionProfileId()
    if (!userId) throw new Error('No se pudo recuperar la sesión.')
    await enterSession(userId)
  }

  async function requestPasswordReset(email: string) {
    if (!backend) return
    await backend.requestPasswordReset(email)
  }

  async function completeAuthLink(input: AuthLinkInput) {
    if (!backend) return
    const userId = await backend.completeAuthLink(input)
    window.history.replaceState(null, '', window.location.pathname)
    setAuthLink(null)
    await enterSession(userId)
  }

  async function enterSession(userId: string) {
    setProfileId(userId)
    setLoading(true)
    try {
      const savedQueue = await loadQueue(userId).catch(() => [])
      queueRef.current = savedQueue
      setQueue(savedQueue)
      await refreshDashboard(userId)
    } finally {
      setLoading(false)
    }
  }

  async function enqueue(mutation: EntryMutation) {
    if (!profileId || !dashboardRef.current) return
    const item: QueuedMutation = {
      mutation,
      status: 'pending',
      error: null,
      createdAt: new Date().toISOString()
    }
    const nextQueue =
      mergePendingMutation(queueRef.current, mutation, (id) =>
        inFlightRef.current.has(id)
      ) ?? [...queueRef.current, item]
    const nextDashboard = applyMutationLocally(dashboardRef.current, mutation)
    dashboardRef.current = nextDashboard
    setDashboard(nextDashboard)
    await updateQueue(nextQueue, profileId)
    scheduleSync()
  }

  async function setMeal(
    date: string,
    slot: MealSlot,
    status: MealStatus | null
  ) {
    const entry = mealEntryFor(dashboardRef.current!, profileId!, slot.id, date)
    const base = {
      id: crypto.randomUUID(),
      profileId: profileId!,
      entryDate: date,
      mealSlotId: slot.id,
      expectedVersion: entry?.version ?? 0
    }
    await enqueue(
      status
        ? { ...base, type: 'upsert-meal', status }
        : { ...base, type: 'clear-meal' }
    )
  }

  async function setWorkout(
    date: string,
    done: boolean,
    details?: { workoutType: string; note: string }
  ) {
    const entry = workoutForDate(dashboardRef.current!, profileId!, date)
    const base = {
      id: crypto.randomUUID(),
      profileId: profileId!,
      entryDate: date,
      expectedVersion: entry?.version ?? 0
    }
    if (!done) {
      await enqueue({ ...base, type: 'clear-workout' })
      return
    }
    const mutation: EntryMutation = {
      ...base,
      type: 'upsert-workout',
      workoutType: details?.workoutType.trim() || entry?.workoutType || null,
      note: details?.note.trim() || entry?.note || null
    }
    await enqueue(mutation)
    if (!entry) {
      const key = `local-${mutation.id}`
      setCelebrateKey(key)
      setNotice('¡Ahhh, un gim!')
      window.setTimeout(() => setCelebrateKey(null), 2600)
    }
  }

  async function setFree(date: string, count: number, note: string | null) {
    const entry = freeMealEntryFor(dashboardRef.current!, profileId!, date)
    const base = {
      id: crypto.randomUUID(),
      profileId: profileId!,
      entryDate: date,
      expectedVersion: entry?.version ?? 0
    }
    await enqueue(
      count > 0
        ? { ...base, type: 'upsert-free', count, note }
        : { ...base, type: 'clear-free' }
    )
  }

  async function setExtra(
    date: string,
    entry: {
      level: ExtraLevel
      note: string | null
    } | null
  ) {
    const existing = extraEntryFor(dashboardRef.current!, profileId!, date)
    const base = {
      id: crypto.randomUUID(),
      profileId: profileId!,
      entryDate: date,
      expectedVersion: existing?.version ?? 0
    }
    await enqueue(
      entry
        ? { ...base, type: 'upsert-extra', ...entry }
        : { ...base, type: 'clear-extra' }
    )
  }

  async function saveRoutineDay(
    date: string,
    payload: {
      routineId: string | null
      exercises: RoutineDayExercise[]
      completed: boolean
    }
  ) {
    if (!profileId) return
    const existing = routineDayFor(dashboardRef.current!, profileId, date)
    await enqueue({
      id: crypto.randomUUID(),
      type: 'upsert-routine-day',
      profileId,
      entryDate: date,
      routineId: payload.routineId,
      exercises: payload.exercises,
      completed: payload.completed,
      expectedVersion: existing?.version ?? 0
    })
  }

  function saveRoutineTemplate(
    routineId: string | null,
    name: string,
    exercises: RoutineExercise[]
  ): string {
    const existing = routineId
      ? dashboardRef.current?.routines.find(
          (routine) => routine.id === routineId
        )
      : null
    const id = routineId ?? crypto.randomUUID()
    void enqueue({
      id: crypto.randomUUID(),
      type: 'upsert-routine',
      profileId: profileId!,
      routineId: id,
      name,
      exercises,
      expectedVersion: existing?.version ?? null
    })
    return id
  }

  function deleteRoutineTemplate(routineId: string) {
    const existing = dashboardRef.current?.routines.find(
      (routine) => routine.id === routineId
    )
    void enqueue({
      id: crypto.randomUUID(),
      type: 'delete-routine',
      profileId: profileId!,
      routineId,
      expectedVersion: existing?.version ?? null
    })
  }

  function setRoutineWeekday(weekday: number, routineId: string | null) {
    void enqueue({
      id: crypto.randomUUID(),
      type: 'set-routine-weekday',
      profileId: profileId!,
      weekday,
      routineId
    })
  }

  const routineActions = {
    saveTemplate: saveRoutineTemplate,
    deleteTemplate: deleteRoutineTemplate,
    setWeekday: setRoutineWeekday
  }

  async function savePlan(input: PlanInput) {
    if (!backend || !navigator.onLine)
      throw new Error('El plan necesita conexión para guardarse.')
    const remote = await backend.savePlan(crypto.randomUUID(), input)
    const visible = applyQueueToDashboard(remote, queueRef.current)
    dashboardRef.current = visible
    setDashboard(visible)
    if (profileId)
      await saveDashboardSnapshot(profileId, remote).catch(() => undefined)
    setNotice('Plan guardado.')
  }

  async function confirmMonth(monthKey: string) {
    if (!backend || !compId) return
    await backend.confirmMonth(compId, monthKey)
    await refreshDashboard()
    setNotice('Mes confirmado.')
  }

  async function createCompetition(name: string, timezone: string) {
    if (!backend) return
    let next: Dashboard
    try {
      next = await backend.createCompetition(
        crypto.randomUUID(),
        name,
        timezone
      )
    } catch (cause) {
      throw new Error(competitionError(cause), { cause })
    }
    dashboardRef.current = next
    setDashboard(next)
    const created = next.competitions.find(
      (item) => item.createdBy === profileId && !dashboard?.competitions.some(
        (existing) => existing.id === item.id
      )
    )
    if (created) setActiveCompId(created.id)
  }

  async function inviteMember(
    competitionId: string,
    email: string
  ): Promise<'sent' | 'existing_user'> {
    if (!backend) throw new Error('invite_failed')
    try {
      return await backend.inviteMember(competitionId, email)
    } catch (cause) {
      throw new Error(competitionError(cause), { cause })
    }
  }

  async function joinCompetition(code: string) {
    if (!backend) return
    let next: Dashboard
    try {
      next = await backend.joinCompetition(crypto.randomUUID(), code)
    } catch (cause) {
      throw new Error(competitionError(cause), { cause })
    }
    dashboardRef.current = next
    setDashboard(next)
    const joined = next.competitions.find(
      (item) => !dashboard?.competitions.some((existing) => existing.id === item.id)
    )
    if (joined) setActiveCompId(joined.id)
  }

  async function leaveCompetition(competitionId: string) {
    if (!backend) return
    let next: Dashboard
    try {
      next = await backend.leaveCompetition(
        crypto.randomUUID(),
        competitionId
      )
    } catch (cause) {
      throw new Error(competitionError(cause), { cause })
    }
    dashboardRef.current = next
    setDashboard(next)
  }

  async function regenerateInviteCode(competitionId: string) {
    if (!backend) return
    let next: Dashboard
    try {
      next = await backend.regenerateInviteCode(
        crypto.randomUUID(),
        competitionId
      )
    } catch (cause) {
      throw new Error(competitionError(cause), { cause })
    }
    dashboardRef.current = next
    setDashboard(next)
  }

  async function restoreVisibleFromSnapshot(nextQueue: QueuedMutation[]) {
    if (!profileId) return
    const snapshot = await loadDashboardSnapshot(profileId).catch(() => null)
    if (!snapshot) {
      if (navigator.onLine) await refreshDashboard()
      return
    }
    const visible = applyQueueToDashboard(snapshot, nextQueue)
    dashboardRef.current = visible
    setDashboard(visible)
  }

  async function retryFailedMutation(mutationId: string) {
    if (!profileId) return
    const nextQueue = queueRef.current.map((item) =>
      item.mutation.id === mutationId
        ? { ...item, status: 'pending' as const, error: null }
        : item
    )
    await updateQueue(nextQueue, profileId)
    await restoreVisibleFromSnapshot(nextQueue)
    void syncPending()
  }

  async function discardFailedMutation(mutationId: string) {
    if (!profileId) return
    const nextQueue = queueRef.current.filter(
      (item) => item.mutation.id !== mutationId
    )
    await updateQueue(nextQueue, profileId)
    await restoreVisibleFromSnapshot(nextQueue)
    setNotice(
      'Cambio descartado. Puedes registrarlo otra vez si sigue abierto.'
    )
  }

  if (backendState.error || !backend) {
    return (
      <LoginScreen
        onSignIn={signIn}
        onResetPassword={requestPasswordReset}
        configurationError={backendState.error ?? 'Configuración incompleta.'}
      />
    )
  }

  if (authLink) {
    return (
      <AuthLinkScreen
        tokenHash={authLink.tokenHash}
        type={authLink.type}
        onComplete={completeAuthLink}
        onCancel={() => {
          window.history.replaceState(null, '', window.location.pathname)
          setAuthLink(null)
        }}
      />
    )
  }

  if (loading && !dashboard) {
    return (
      <main className='loading-screen'>
        <span className='loader' />
        Cargando tu gim…
      </main>
    )
  }

  if (!online && !dashboard) {
    return (
      <main className='offline-screen'>
        <a
          className='offline-mark'
          href='/'
          aria-label='Ir a la página de inicio de Ahhh Un Gim'
        >
          <BrandIcon />
          <span className='offline-cloud' aria-hidden='true'>
            <CloudOffIcon />
          </span>
        </a>
        <h1>Nos vemos en línea.</h1>
        <p>
          {profileId
            ? 'Este dispositivo aún no tiene datos guardados. Conéctate para descargarlos y luego podrás registrar tu día sin internet.'
            : 'Conéctate para iniciar sesión una vez. Después podrás registrar tu día incluso sin internet.'}
        </p>
        <span className='offline-hint'>
          La primera descarga necesita conexión.
        </span>
      </main>
    )
  }

  if (!profileId) {
    return (
      <LoginScreen
        onSignIn={signIn}
        onResetPassword={requestPasswordReset}
        configurationError={null}
      />
    )
  }

  if (!dashboard) {
    return (
      <main className='loading-screen'>
        <p>No hay datos guardados en este dispositivo.</p>
        <button
          className='btn btn-primary'
          type='button'
          onClick={() => void refreshDashboard(profileId)}
        >
          Reintentar
        </button>
      </main>
    )
  }

  const profile = dashboard.profiles.find((item) => item.id === profileId)
  const needsSetup = !profile?.configuredAt
  const failedItem = queue.find((item) => item.status === 'error')
  const queueError = failedItem?.error
    ? friendlySyncError(failedItem.error)
    : null
  const competitions = dashboard.competitions
  const compId =
    activeCompId && competitions.some((item) => item.id === activeCompId)
      ? activeCompId
      : (competitions[0]?.id ?? null)
  const scoped = compId ? scopeDashboard(dashboard, compId) : dashboard
  const rivals = scoped.profiles.filter(
    (item) => item.id !== dashboard.currentProfileId
  )
  const pendingCount = queue.filter((item) => item.status === 'pending').length
  const startsOn = dashboard.settings?.startsOn ?? null
  const dayEditable = (date: string) =>
    Boolean(
      startsOn &&
      date >= startsOn &&
      date <= today &&
      (dashboard.competitions.length === 0 ||
        dashboard.competitions.some(
          (competition) =>
            !dashboard.months[competition.id]?.[monthKeyForDate(date)]
              ?.closedAt
        ))
    )

  const tabs: Array<{
    id: Route
    label: string
    Icon: typeof HomeIcon
    slot: number
  }> = [
    { id: 'today', label: 'Hoy', Icon: HomeIcon, slot: 0 },
    { id: 'score', label: 'Marcador', Icon: TrophyIcon, slot: 1 },
    { id: 'history', label: 'Historial', Icon: CalendarIcon, slot: 2 }
  ]

  function signOut() {
    void backend?.signOut().then(() => {
      setAccountOpen(false)
      setActiveCompId(null)
      setProfileId(null)
      setDashboard(null)
    })
  }

  return (
    <div className='app-shell'>
      <div className='chrome'>
        <a className='brand' href='/' aria-label='Ir a la página de inicio'>
          <BrandIcon className='brand-donut' />
          <span>
            Ahhh,
            <br />
            un gim!
          </span>
        </a>
        {!needsSetup && (
          <nav className='tabbar' aria-label='Navegación principal'>
            <div className='tab-pill'>
              <span
                className='tab-glow'
                style={{
                  transform: `translateX(${(tabs.find((t) => t.id === route)?.slot ?? 0) * 100}%)`
                }}
                aria-hidden='true'
              />
              {tabs.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type='button'
                  className={`tab ${route === id ? 'is-active' : ''}`}
                  aria-current={route === id ? 'page' : undefined}
                  onClick={() => setRoute(id)}
                >
                  <Icon filled={route === id} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <button
              type='button'
              className='tab-donut'
              aria-label='Registrar hoy'
              onClick={() => setDaySheet(today)}
            >
              <DonutIcon />
            </button>
            <button
              type='button'
              className='btn quick-log'
              onClick={() => setDaySheet(today)}
            >
              <DonutIcon className='quick-log-donut' />
              Registrar hoy
            </button>
          </nav>
        )}
        <header className='topbar'>
          <div className='topbar-side'>
            <a
              className='topbar-logo-link'
              href='/'
              aria-label='Ir a la página de inicio'
            >
              <BrandIcon className='topbar-mark' />
            </a>
            <StatusPill
              online={online}
              pending={
                pendingCount +
                queue.filter((item) => item.status === 'error').length
              }
              error={queueError}
            />
          </div>
          <div className='topbar-actions'>
            <button
              className='help-button'
              type='button'
              aria-label='¿Cómo funciona?'
              onClick={() => setHelpOpen(true)}
            >
              <HelpIcon />
            </button>
            <button
              className='account-button'
              type='button'
              aria-label={`Cuenta de ${profile?.displayName ?? 'usuario'}${rivals.length ? `, en reto con ${rivals.map((item) => item.displayName).join(', ')}` : ''}`}
              onClick={() => setAccountOpen(true)}
            >
              <span className='avatar-stack'>
                {rivals.slice(0, 2).map((rival) => (
                  <Avatar
                    key={rival.id}
                    name={rival.displayName}
                    color={rival.avatarColor}
                    size='sm'
                  />
                ))}
                <Avatar
                  name={profile?.displayName ?? '?'}
                  color={profile?.avatarColor ?? '#14110f'}
                  size='sm'
                />
              </span>
              <span className='account-name'>{profile?.displayName}</span>
            </button>
          </div>
        </header>
      </div>

      <div className='stage'>
        {failedItem && (
          <section className='sync-error' role='alert'>
            <div>
              <strong>Cambio pendiente de revisión</strong>
              <p>
                {describeMutation(failedItem.mutation)} · {queueError}
              </p>
            </div>
            <div className='sync-error-actions'>
              <button
                className='btn'
                type='button'
                onClick={() => void retryFailedMutation(failedItem.mutation.id)}
              >
                Reintentar
              </button>
              <button
                className='btn-link'
                type='button'
                onClick={() =>
                  void discardFailedMutation(failedItem.mutation.id)
                }
              >
                Descartar
              </button>
            </div>
          </section>
        )}

        {needsSetup ? (
          <PlanScreen
            dashboard={dashboard}
            onSave={savePlan}
            onRoutine={routineActions}
          />
        ) : (
          <>
            {route === 'today' && (
              <TodayScreen
                dashboard={dashboard}
                today={today}
                celebrateKey={celebrateKey}
                onMeal={setMeal}
                onWorkout={(date, done) => void setWorkout(date, done)}
                onFree={(date, count, note) => void setFree(date, count, note)}
                onExtra={(date, entry) => void setExtra(date, entry)}
                onOpenDetails={setDetailsDate}
                onOpenRoutine={() => setRoutineDate(today)}
                onEditPlan={() => setPlanOpen(true)}
                onShareToday={() => {
                  setShareKind('today')
                  setShareOpen(true)
                }}
              />
            )}
            {(route === 'score' || route === 'history') && (
              <CompetitionSwitcher
                competitions={competitions}
                activeId={compId}
                onSelect={setActiveCompId}
              />
            )}
            {route === 'score' && compId && (
              <ScoreboardScreen
                dashboard={scoped}
                competitionId={compId}
                today={today}
                online={online}
                pendingCount={queue.length}
                onRequestClose={setCloseMonthKey}
                onShare={() => {
                  setShareKind('race')
                  setShareOpen(true)
                }}
              />
            )}
            {route === 'score' && !compId && (
              <main className='screen'>
                <section className='block empty-copy'>
                  <h2 className='block-title'>Todavía no escalas ninguna Cumbre</h2>
                  <p>
                    Crea una Cumbre o únete con una barrita desde Mis Cumbres en
                    tu cuenta.
                  </p>
                  <button
                    className='btn btn-primary'
                    type='button'
                    onClick={() => setCumbresOpen(true)}
                  >
                    Mis Cumbres
                  </button>
                </section>
              </main>
            )}
            {route === 'history' && compId && (
              <HistoryScreen
                dashboard={scoped}
                competitionId={compId}
                today={today}
                onOpenDay={setDaySheet}
                historyStart={dashboard.settings?.startsOn ?? null}
              />
            )}
          </>
        )}
      </div>

      {notice && (
        <div className='toast' role='status'>
          {notice}
        </div>
      )}

      {celebrateKey && <Celebration key={celebrateKey} />}

      {shareOpen && (
        <ShareSheet
          key={shareKind}
          dashboard={shareKind === 'race' ? scoped : dashboard}
          today={today}
          initialKind={shareKind}
          onClose={() => setShareOpen(false)}
        />
      )}

      {accountOpen && (
        <Sheet title='Cuenta' onClose={() => setAccountOpen(false)}>
          {(close) => (
            <AccountPanel
              profile={profile}
              rivals={rivals}
              onManageCompetitions={() => {
                setAccountOpen(false)
                setCumbresOpen(true)
              }}
              onEditPlan={
                needsSetup
                  ? close
                  : () => {
                      setAccountOpen(false)
                      setPlanOpen(true)
                    }
              }
              onInstall={() => {
                setAccountOpen(false)
                setInstallOpen(true)
              }}
              onHelp={() => {
                setAccountOpen(false)
                setHelpOpen(true)
              }}
              onSignOut={signOut}
            />
          )}
        </Sheet>
      )}

      {planOpen && !needsSetup && (
        <Sheet title='Ajustar plan' wide onClose={() => setPlanOpen(false)}>
          {(close) => (
            <PlanScreen
              embedded
              dashboard={dashboard}
              onSave={savePlan}
              onCancel={close}
              onSaved={close}
              onRoutine={routineActions}
            />
          )}
        </Sheet>
      )}

      {daySheet && (
        <Sheet
          title={formatDay(daySheet)}
          wide
          onClose={() => setDaySheet(null)}
        >
          <DayEditor
            dashboard={dashboard}
            profileId={dashboard.currentProfileId}
            date={daySheet}
            editable={dayEditable(daySheet)}
            celebrateKey={celebrateKey ?? undefined}
            onMeal={setMeal}
            onWorkout={(date, done) => void setWorkout(date, done)}
            onFree={(date, count, note) => void setFree(date, count, note)}
            onExtra={(date, entry) => void setExtra(date, entry)}
            onOpenDetails={setDetailsDate}
            onOpenRoutine={() => setRoutineDate(daySheet)}
          />
        </Sheet>
      )}

      {routineDate && (
        <Sheet title='Mi rutina' onClose={() => setRoutineDate(null)}>
          {(close) => (
            <RoutinePanel
              date={routineDate}
              templates={dashboard.routines}
              weekday={dashboard.routineSchedule}
              savedDay={
                routineDayFor(
                  dashboard,
                  dashboard.currentProfileId,
                  routineDate
                ) ?? null
              }
              onSaveDay={(payload) => void saveRoutineDay(routineDate, payload)}
              onSaveTemplate={saveRoutineTemplate}
              onComplete={
                dayEditable(routineDate)
                  ? (routineName) =>
                      void setWorkout(routineDate, true, {
                        workoutType: 'Rutina',
                        note: routineName ?? ''
                      })
                  : undefined
              }
              onClose={close}
            />
          )}
        </Sheet>
      )}

      {detailsDate && (
        <Sheet
          title='Detalle del entrenamiento'
          onClose={() => setDetailsDate(null)}
        >
          {(close) => (
            <WorkoutDetailsForm
              workout={workoutForDate(dashboard, profileId, detailsDate)}
              onSubmit={(workoutType, note) => {
                void setWorkout(detailsDate, true, { workoutType, note })
                close()
              }}
            />
          )}
        </Sheet>
      )}

      {cumbresOpen && (
        <Sheet title='Mis Cumbres' wide onClose={() => setCumbresOpen(false)}>
          <CumbresPanel
            dashboard={dashboard}
            initialJoinCode={joinCode ?? undefined}
            onCreate={createCompetition}
            onJoin={joinCompetition}
            onLeave={leaveCompetition}
            onRegenerate={regenerateInviteCode}
            onInvite={inviteMember}
          />
        </Sheet>
      )}

      {installOpen && (
        <Sheet title='Instalar la app' onClose={() => setInstallOpen(false)}>
          <InstallHelp />
        </Sheet>
      )}

      {helpOpen && (
        <Sheet title='¿Cómo funciona?' wide onClose={() => setHelpOpen(false)}>
          <HelpPanel />
        </Sheet>
      )}

      {closeMonthKey && (
        <Sheet
          title={`Cerrar ${formatMonth(closeMonthKey)}`}
          onClose={() => setCloseMonthKey(null)}
        >
          {(close) => (
            <ConfirmMonthForm
              dashboard={scoped}
              competitionId={compId!}
              monthKey={closeMonthKey}
              online={online}
              pendingCount={queue.length}
              onConfirm={confirmMonth}
              onDone={close}
            />
          )}
        </Sheet>
      )}
    </div>
  )
}
