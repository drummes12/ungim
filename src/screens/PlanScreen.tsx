import { useMemo, useState, type FormEvent } from 'react'
import {
  addDays,
  commonTimezones,
  formatWeekRange,
  isoWeekStart,
  todayInTimezone
} from '../lib/dates'
import { activePlanForDate } from '../lib/scoring'
import type { Dashboard, PlanInput } from '../lib/types'

export function PlanScreen({
  dashboard,
  onSave,
  onCancel,
  onSaved,
  embedded = false
}: {
  dashboard: Dashboard
  onSave: (input: PlanInput) => Promise<void>
  onCancel?: () => void
  onSaved?: () => void
  embedded?: boolean
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
  const effectiveWeek = addDays(
    isoWeekStart(today),
    hasPlan && dashboard.settings?.startsOn ? 7 : 0
  )
  const currentPlan = activePlanForDate(
    dashboard,
    dashboard.currentProfileId,
    today
  )
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
          <div className='stepper'>
            <button
              type='button'
              onClick={() => setWorkoutTarget(Math.max(1, workoutTarget - 1))}
            >
              −
            </button>
            <strong>{workoutTarget}</strong>
            <button
              type='button'
              onClick={() => setWorkoutTarget(Math.min(7, workoutTarget + 1))}
            >
              +
            </button>
          </div>
        </fieldset>

        <fieldset>
          <legend>Comidas libres por mes</legend>
          <div className='stepper'>
            <button
              type='button'
              onClick={() =>
                setFreeMealsPerMonth(Math.max(0, freeMealsPerMonth - 1))
              }
            >
              −
            </button>
            <strong>{freeMealsPerMonth}</strong>
            <button
              type='button'
              onClick={() =>
                setFreeMealsPerMonth(Math.min(15, freeMealsPerMonth + 1))
              }
            >
              +
            </button>
          </div>
          <p className='field-note'>
            Postres, helados y antojos fuera del plan. Las que pasen del cupo
            cuentan como comida fallida. Pon 0 para desactivarlas.
          </p>
        </fieldset>

        <fieldset>
          <legend>Comidas del plan</legend>
          {meals.map((meal, index) => (
            <div className='meal-edit' key={index}>
              <input
                aria-label={`Nombre de comida ${index + 1}`}
                value={meal.name}
                onChange={(event) =>
                  setMeals(
                    meals.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, name: event.target.value }
                        : item
                    )
                  )
                }
                maxLength={40}
                placeholder='Comida'
                required
              />
              <input
                aria-label={`Regla de ${meal.name || index + 1}`}
                value={meal.rule}
                onChange={(event) =>
                  setMeals(
                    meals.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, rule: event.target.value }
                        : item
                    )
                  )
                }
                maxLength={180}
                placeholder='Regla breve'
                required
              />
              <button
                type='button'
                className='icon-remove'
                disabled={meals.length <= 1}
                onClick={() =>
                  setMeals(meals.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                Quitar
              </button>
            </div>
          ))}
          <button
            type='button'
            className='btn'
            disabled={meals.length >= 5}
            onClick={() => setMeals([...meals, { name: '', rule: '' }])}
          >
            Añadir comida
          </button>
        </fieldset>

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
