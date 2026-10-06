import { useMemo, useState, type FormEvent } from 'react'
import {
  addDays,
  commonTimezones,
  formatWeekRange,
  isoWeekStart,
  todayInTimezone
} from '../lib/dates'
import { activePlanForDate } from '../lib/scoring'
import type { Dashboard, PlanInput, RoutineExercise } from '../lib/types'
import { CalendarIcon } from '../components/icons'
import { NumField } from '../components/fields'
import { MealManager } from '../components/meals'
import { RoutineManager } from '../components/routine'

export function PlanScreen({
  dashboard,
  onSave,
  onCancel,
  onSaved,
  embedded = false,
  onRoutine
}: {
  dashboard: Dashboard
  onSave: (input: PlanInput) => Promise<void>
  onCancel?: () => void
  onSaved?: () => void
  embedded?: boolean
  onRoutine: {
    saveTemplate: (
      id: string | null,
      name: string,
      exercises: RoutineExercise[]
    ) => string
    deleteTemplate: (id: string) => void
    setWeekday: (weekday: number, routineId: string | null) => void
  }
}) {
  const profile = dashboard.profiles.find(
    (item) => item.id === dashboard.currentProfileId
  )
  const browserTimezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const timezone = dashboard.settings?.homeTimezone ?? browserTimezone
  const today = todayInTimezone(timezone)
  const hasPlan = dashboard.planVersions.some(
    (plan) => plan.profileId === dashboard.currentProfileId
  )
  const appliesNextWeek = Boolean(
    hasPlan &&
      dashboard.settings?.startsOn &&
      today >= dashboard.settings.startsOn
  )
  const effectiveWeek = addDays(isoWeekStart(today), appliesNextWeek ? 7 : 0)
  const currentPlan = activePlanForDate(
    dashboard,
    dashboard.currentProfileId,
    effectiveWeek
  )
  const pendingPlan =
    currentPlan && currentPlan.effectiveWeekStart > isoWeekStart(today)
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [selectedTimezone, setSelectedTimezone] = useState(timezone)
  const [workoutTarget, setWorkoutTarget] = useState(
    currentPlan?.workoutTarget ?? 3
  )
  const [freeMealsPerMonth, setFreeMealsPerMonth] = useState(
    currentPlan?.freeMealsPerMonth ?? 0
  )
  const [meals, setMeals] = useState(
    currentPlan?.meals.map(({ name, rule }) => ({ name, rule })) ?? [
      { name: 'Desayuno', rule: '' },
      { name: 'Comida', rule: '' },
      { name: 'Cena', rule: '' }
    ]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timezones = useMemo(() => commonTimezones(), [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!displayName.trim()) {
      setError('El nombre visible no puede quedar vacío.')
      return
    }
    if (meals.some((meal) => !meal.name.trim() || !meal.rule.trim())) {
      setError('Cada comida necesita nombre y regla breve.')
      return
    }
    setSaving(true)
    try {
      await onSave({
        displayName: displayName.trim(),
        timezone: selectedTimezone,
        workoutTarget,
        freeMealsPerMonth,
        meals: meals.map((meal) => ({
          name: meal.name.trim(),
          rule: meal.rule.trim()
        }))
      })
      onSaved?.()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'No se pudo guardar el plan.'
      )
      setSaving(false)
    }
  }

  const intro = hasPlan
    ? dashboard.settings?.startsOn
      ? `Los cambios aplican desde la semana ${formatWeekRange(effectiveWeek)}.`
      : 'Puedes corregir el plan antes de que arranque la competencia.'
    : 'La competencia inicia cuando ambos terminen su configuración.'
  const Wrapper = embedded ? 'div' : 'main'

  return (
    <Wrapper className={embedded ? 'plan-embedded' : 'screen plan-screen'}>
      {embedded ? (
        <p className='page-sub'>{intro}</p>
      ) : (
        <header className='page-head'>
          <div>
            <h1>{hasPlan ? 'Ajustar plan' : 'Configura tu plan'}</h1>
            <p className='page-sub'>{intro}</p>
          </div>
        </header>
      )}

      <form className='plan-form' onSubmit={submit}>
        {appliesNextWeek && (
          <section className='notice' role='status'>
            <CalendarIcon />
            <div>
              <strong>
                {pendingPlan
                  ? 'Tienes cambios programados'
                  : 'Los cambios no aplican de inmediato'}
              </strong>
              <p>
                {pendingPlan
                  ? `Estás editando la versión que entra en vigor la semana ${formatWeekRange(currentPlan.effectiveWeekStart)}.`
                  : `Lo que guardes aplicará desde la semana ${formatWeekRange(effectiveWeek)}.`}
              </p>
            </div>
          </section>
        )}
        <label>
          Nombre visible
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={40}
            required
          />
        </label>

        <label>
          Zona horaria del hogar
          <select
            value={selectedTimezone}
            disabled={Boolean(dashboard.settings)}
            onChange={(event) => setSelectedTimezone(event.target.value)}
            required
          >
            {timezones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </label>
        {dashboard.settings && (
          <p className='field-note'>
            Compartida por ambos: {dashboard.settings.homeTimezone}
          </p>
        )}

        <fieldset>
          <legend>Entrenamientos por semana</legend>
          <NumField
            value={workoutTarget}
            min={1}
            max={7}
            decLabel='Menos entrenamientos'
            incLabel='Más entrenamientos'
            onChange={setWorkoutTarget}
          />
        </fieldset>

        <fieldset>
          <legend>Comidas libres por mes</legend>
          <NumField
            value={freeMealsPerMonth}
            min={0}
            max={15}
            decLabel='Menos comidas libres'
            incLabel='Más comidas libres'
            onChange={setFreeMealsPerMonth}
          />
          <p className='field-note'>
            Postres, helados y antojos fuera del plan. El cupo son las que
            salen gratis al mes; las que lo pasen cuentan como comida
            fallida. Con 0, cada libre cuenta como fallo.
          </p>
        </fieldset>

        <MealManager meals={meals} onChange={setMeals} />

        <RoutineManager
          templates={dashboard.routines}
          weekday={dashboard.routineSchedule}
          onSaveTemplate={onRoutine.saveTemplate}
          onDeleteTemplate={onRoutine.deleteTemplate}
          onSetWeekday={onRoutine.setWeekday}
        />

        {error && (
          <p className='form-error' role='alert'>
            {error}
          </p>
        )}
        <div className='form-actions'>
          {onCancel && (
            <button
              className='btn'
              type='button'
              onClick={onCancel}
            >
              Cancelar
            </button>
          )}
          <button className='btn btn-primary' type='submit' disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar plan'}
          </button>
        </div>
      </form>
    </Wrapper>
  )
}
