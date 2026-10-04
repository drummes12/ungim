import { formatDay } from '../lib/dates'
import { workoutProgressThisWeek } from '../lib/scoring'
import type { Dashboard, MealSlot, MealStatus } from '../lib/types'
import { DayEditor } from '../components/DayEditor'
import { WeekStrip } from '../components/charts'
import { DonutIcon } from '../components/icons'

export function TodayScreen({
  dashboard,
  today,
  celebrateKey,
  onMeal,
  onWorkout,
  onFree,
  onOpenDetails,
  onEditPlan
}: {
  dashboard: Dashboard
  today: string
  celebrateKey: string | null
  onMeal: (date: string, slot: MealSlot, status: MealStatus | null) => void
  onWorkout: (date: string, done: boolean) => void
  onFree: (date: string, count: number, note: string | null) => void
  onOpenDetails: (date: string) => void
  onEditPlan: () => void
}) {
  const profile = dashboard.profiles.find(
    (item) => item.id === dashboard.currentProfileId
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
      <header className='page-head'>
        <div>
          <h1>Hola, {profile?.displayName ?? 'crack'}.</h1>
          <p className='page-sub'>
            <span className='num'>{formatDay(today)}</span>
            {progress.target
              ? ` · Van ${progress.done} de ${progress.target} entrenamientos esta semana.`
              : ' · Configura tu plan para empezar la competencia.'}
          </p>
        </div>
        <button className='btn' type='button' onClick={onEditPlan}>
          Plan
        </button>
      </header>

      {!dashboard.settings?.startsOn && (
        <section className='notice'>
          <DonutIcon className='notice-donut' />
          <div>
            <strong>La competencia aún no arranca</strong>
            <p>Empieza cuando ambos terminen de configurar su plan.</p>
          </div>
        </section>
      )}

      <div className='split'>
        <div className='split-main'>
          <DayEditor
            dashboard={dashboard}
            profileId={dashboard.currentProfileId}
            date={today}
            editable={editable}
            celebrateKey={celebrateKey ?? undefined}
            onMeal={onMeal}
            onWorkout={onWorkout}
            onFree={onFree}
            onOpenDetails={onOpenDetails}
          />
        </div>

        <div className='split-side'>
          <section className='block' aria-label='Tu semana'>
            <h2 className='block-title'>Tu semana</h2>
            <WeekStrip
              dashboard={dashboard}
              profileId={dashboard.currentProfileId}
              today={today}
              color={profile?.avatarColor ?? '#ff9078'}
            />
            <div
              className='pips'
              role='img'
              aria-label={`${progress.done} de ${progress.target} entrenamientos`}
            >
              {Array.from({ length: progress.target }).map((_, index) => (
                <i
                  key={index}
                  className={index < progress.done ? 'pip is-on' : 'pip'}
                />
              ))}
              <span>
                {progress.target
                  ? progress.done >= progress.target
                    ? 'Objetivo de ejercicio cumplido.'
                    : `Faltan ${progress.target - progress.done} para el objetivo.`
                  : 'Sin objetivo activo esta semana.'}
              </span>
            </div>
          </section>

        </div>
      </div>
    </main>
  )
}
