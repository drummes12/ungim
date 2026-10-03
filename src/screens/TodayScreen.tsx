import { formatDay, isoWeekStart } from '../lib/dates'
import { computeMonthScore, workoutProgressThisWeek } from '../lib/scoring'
import type { Dashboard, MealSlot, MealStatus } from '../lib/types'
import { DayEditor } from '../components/DayEditor'
import { DonutIcon } from '../components/icons'

export function TodayScreen({
  dashboard,
  today,
  celebrateKey,
  onMeal,
  onWorkout,
  onWorkoutDetails,
  onEditPlan
}: {
  dashboard: Dashboard
  today: string
  celebrateKey: string | null
  onMeal: (date: string, slot: MealSlot, status: MealStatus | null) => void
  onWorkout: (date: string, done: boolean) => void
  onWorkoutDetails: (date: string, workoutType: string, note: string) => void
  onEditPlan: () => void
}) {
  const profile = dashboard.profiles.find(
    (item) => item.id === dashboard.currentProfileId
  )
  const score = computeMonthScore(
    dashboard,
    today.slice(0, 7),
    today
  ).participants.find(
    (participant) => participant.profileId === dashboard.currentProfileId
  )
  const progress = workoutProgressThisWeek(
    dashboard,
    dashboard.currentProfileId,
    today
  )
  const editable = Boolean(
    dashboard.settings?.startsOn && today >= dashboard.settings.startsOn
  )

  return (
    <main className='screen today-screen'>
      <header className='hero-header'>
        <div>
          <h1>Hola, {profile?.displayName ?? 'crack'}.</h1>
          <p className='section-label'>{formatDay(today)}</p>
          <p className='hero-copy'>
            {progress.target
              ? `Van ${progress.done} de ${progress.target} entrenamientos esta semana.`
              : 'Configura tu plan para empezar la competencia.'}
          </p>
        </div>
        <button className='plan-button' type='button' onClick={onEditPlan}>
          Plan
        </button>
      </header>

      {!dashboard.settings?.startsOn && (
        <section className='notice-card'>
          <DonutIcon className='notice-donut' />
          <div>
            <strong>La competencia aún no arranca</strong>
            <p>Empieza cuando ambos terminen de configurar su plan.</p>
          </div>
        </section>
      )}

      <section className='quick-score-card'>
        <div>
          <span>Total del mes</span>
          <strong>{score?.noData ? '—' : score?.total.toFixed(1)}</strong>
        </div>
        <div>
          <span>Racha</span>
          <strong>{score?.streak ?? 0}</strong>
        </div>
        <div>
          <span>Rosquillas</span>
          <strong>{score?.bonus ?? 0}</strong>
        </div>
      </section>

      <DayEditor
        dashboard={dashboard}
        profileId={dashboard.currentProfileId}
        date={today}
        editable={editable}
        celebrateKey={celebrateKey ?? undefined}
        onMeal={onMeal}
        onWorkout={onWorkout}
        onWorkoutDetails={onWorkoutDetails}
      />

      <section className='week-card'>
        <h2 className='card-title'>Semana {isoWeekStart(today)}</h2>
        <div
          className='progress-track'
          aria-label={`${progress.done} de ${progress.target} entrenamientos`}
        >
          <span
            style={{
              transform: `scaleX(${progress.target ? Math.min(1, progress.done / progress.target) : 0})`
            }}
          />
        </div>
        <p>
          {progress.target
            ? progress.done >= progress.target
              ? 'Objetivo de ejercicio cumplido.'
              : `Faltan ${progress.target - progress.done} para el objetivo.`
            : 'Sin objetivo activo esta semana.'}
        </p>
      </section>
    </main>
  )
}
