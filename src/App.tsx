import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createBackend } from './lib/api'
import {
  formatDay,
  formatMonth,
  monthKeyForDate,
  todayInTimezone
} from './lib/dates'
import { applyMutationLocally } from './lib/mutations'
import { mealEntryFor, workoutForDate } from './lib/scoring'
import {
  loadDashboardSnapshot,
  loadQueue,
  saveDashboardSnapshot,
  saveQueue
} from './lib/storage'
import type {
  BackendApi,
  Dashboard,
  EntryMutation,
  MealSlot,
  MealStatus,
  PlanInput,
  QueuedMutation
} from './lib/types'
import { Avatar } from './components/Avatar'
import { DayEditor } from './components/DayEditor'
import { Sheet } from './components/Sheet'
import { StatusPill } from './components/StatusPill'
import { Celebration } from './components/Celebration'
import {
  AccountPanel,
  ConfirmMonthForm,
  WorkoutDetailsForm
} from './components/sheets'
import {
  CalendarIcon,
  BrandIcon,
  DonutIcon,
  HomeIcon,
  TrophyIcon
} from './components/icons'
import { HistoryScreen } from './screens/HistoryScreen'
import { LoginScreen } from './screens/LoginScreen'
import { PlanScreen } from './screens/PlanScreen'
import { ScoreboardScreen } from './screens/ScoreboardScreen'
import { TodayScreen } from './screens/TodayScreen'

type Route = 'today' | 'score' | 'history'

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
  const action = mutation.type.includes('workout')
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
  return message
}

export function App() {
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
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [queue, setQueue] = useState<QueuedMutation[]>([])
  const [online, setOnline] = useState(navigator.onLine)
  const [loading, setLoading] = useState(Boolean(backend))
  const [route, setRoute] = useState<Route>('today')
  const [planOpen, setPlanOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [celebrateKey, setCelebrateKey] = useState<string | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [daySheet, setDaySheet] = useState<string | null>(null)
  const [detailsDate, setDetailsDate] = useState<string | null>(null)
  const [closeMonthKey, setCloseMonthKey] = useState<string | null>(null)
  const queueRef = useRef(queue)
  const queueWriteRef = useRef(Promise.resolve())
  const dashboardRef = useRef(dashboard)
  const syncingRef = useRef(false)

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    dashboardRef.current = dashboard
  }, [dashboard])

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
      let workingQueue = queueRef.current
      for (const item of workingQueue) {
        if (item.status !== 'pending') continue
        try {
          const remote = await backend.applyMutation(item.mutation)
          workingQueue = workingQueue.filter(
            (queued) => queued.mutation.id !== item.mutation.id
          )
          const visible = applyQueueToDashboard(remote, workingQueue)
          dashboardRef.current = visible
          setDashboard(visible)
          await saveDashboardSnapshot(profileId, remote).catch(() => undefined)
          await updateQueue(workingQueue, profileId)
        } catch (cause) {
          workingQueue = workingQueue.map((queued) =>
            queued.mutation.id === item.mutation.id
              ? {
                  ...queued,
                  status: 'error' as const,
                  error:
                    cause instanceof Error ? cause.message : 'No sincronizó'
                }
              : queued
          )
          await updateQueue(workingQueue, profileId)
          const snapshot = await loadDashboardSnapshot(profileId).catch(
            () => null
          )
          if (snapshot) {
            const visible = applyQueueToDashboard(snapshot, workingQueue)
            dashboardRef.current = visible
            setDashboard(visible)
          }
          setNotice('Un cambio quedó pendiente por revisar.')
          break
        }
      }
    } finally {
      syncingRef.current = false
    }
  }, [backend, profileId, updateQueue])

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
      if (navigator.onLine) void refreshDashboard()
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
    const nextQueue = [...queueRef.current, item]
    const nextDashboard = applyMutationLocally(dashboardRef.current, mutation)
    dashboardRef.current = nextDashboard
    setDashboard(nextDashboard)
    await updateQueue(nextQueue, profileId)
    if (navigator.onLine) void syncPending()
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
    if (!backend) return
    await backend.confirmMonth(monthKey)
    await refreshDashboard()
    setNotice('Mes confirmado.')
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

  if (backendState.error) {
    return (
      <LoginScreen onSignIn={signIn} configurationError={backendState.error} />
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

  if (!profileId) {
    return <LoginScreen onSignIn={signIn} configurationError={null} />
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
  const partner = dashboard.profiles.find(
    (item) => item.id !== dashboard.currentProfileId
  )
  const pendingCount = queue.filter((item) => item.status === 'pending').length
  const startsOn = dashboard.settings?.startsOn ?? null
  const dayEditable = (date: string) =>
    Boolean(
      startsOn &&
      date >= startsOn &&
      date <= today &&
      !dashboard.months[monthKeyForDate(date)]?.closedAt
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
      setProfileId(null)
      setDashboard(null)
    })
  }

  return (
    <div className='app-shell'>
      <div className='chrome'>
        <div className='brand'>
          <BrandIcon className='brand-donut' />
          <span>
            Ahhh,
            <br />
            un gim!
          </span>
        </div>
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
          <StatusPill
            online={online}
            pending={
              pendingCount +
              queue.filter((item) => item.status === 'error').length
            }
            error={queueError}
          />
          <button
            className='account-button'
            type='button'
            aria-label={`Cuenta de ${profile?.displayName ?? 'usuario'}${partner ? `, en reto con ${partner.displayName}` : ''}`}
            onClick={() => setAccountOpen(true)}
          >
            <span className='avatar-stack'>
              {partner && (
                <Avatar
                  name={partner.displayName}
                  color={partner.avatarColor}
                  size='sm'
                />
              )}
              <Avatar
                name={profile?.displayName ?? '?'}
                color={profile?.avatarColor ?? '#14110f'}
                size='sm'
              />
            </span>
            <span className='account-name'>{profile?.displayName}</span>
          </button>
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
          <PlanScreen dashboard={dashboard} onSave={savePlan} />
        ) : (
          <>
            {route === 'today' && (
              <TodayScreen
                dashboard={dashboard}
                today={today}
                celebrateKey={celebrateKey}
                onMeal={setMeal}
                onWorkout={(date, done) => void setWorkout(date, done)}
                onOpenDetails={setDetailsDate}
                onEditPlan={() => setPlanOpen(true)}
              />
            )}
            {route === 'score' && (
              <ScoreboardScreen
                dashboard={dashboard}
                today={today}
                online={online}
                pendingCount={queue.length}
                onRequestClose={setCloseMonthKey}
              />
            )}
            {route === 'history' && (
              <HistoryScreen
                dashboard={dashboard}
                today={today}
                onOpenDay={setDaySheet}
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

      {accountOpen && (
        <Sheet title='Cuenta' onClose={() => setAccountOpen(false)}>
          {(close) => (
            <AccountPanel
              profile={profile}
              partner={partner}
              onEditPlan={
                needsSetup
                  ? close
                  : () => {
                      setAccountOpen(false)
                      setPlanOpen(true)
                    }
              }
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
            onOpenDetails={setDetailsDate}
          />
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

      {closeMonthKey && (
        <Sheet
          title={`Cerrar ${formatMonth(closeMonthKey)}`}
          onClose={() => setCloseMonthKey(null)}
        >
          {(close) => (
            <ConfirmMonthForm
              dashboard={dashboard}
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
