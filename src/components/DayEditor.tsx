import { useState } from 'react'
import { formatDay } from '../lib/dates'
import { mealEntryFor, mealsForDate, workoutForDate } from '../lib/scoring'
import type { Dashboard, MealSlot, MealStatus } from '../lib/types'
import { DumbbellIcon } from './icons'

export function DayEditor({
  dashboard,
  profileId,
  date,
  editable,
  celebrateKey,
  onMeal,
  onWorkout,
  onWorkoutDetails
}: {
  dashboard: Dashboard
  profileId: string
  date: string
  editable: boolean
  celebrateKey?: string
  onMeal: (date: string, slot: MealSlot, status: MealStatus | null) => void
  onWorkout: (date: string, done: boolean) => void
  onWorkoutDetails: (date: string, workoutType: string, note: string) => void
}) {
  const meals = mealsForDate(dashboard, profileId, date)
  const workout = workoutForDate(dashboard, profileId, date)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [workoutType, setWorkoutType] = useState(workout?.workoutType ?? '')
  const [note, setNote] = useState(workout?.note ?? '')

  return (
    <section
      className='day-editor'
      aria-label={`Registro de ${formatDay(date)}`}
    >
      <div className='section-heading compact'>
        <h2>
          Comidas <span>{formatDay(date)}</span>
        </h2>
      </div>

      <div className='meal-list'>
        {meals.map((meal) => {
          const entry = mealEntryFor(dashboard, profileId, meal.id, date)
          return (
            <article className='meal-row' key={meal.id}>
              <div>
                <strong>{meal.name}</strong>
                <p>{meal.rule}</p>
              </div>
              <div
                className='meal-actions'
                role='group'
                aria-label={`Estado de ${meal.name}`}
              >
                <button
                  type='button'
                  className={`choice ${entry?.status === 'met' ? 'choice-met' : ''}`}
                  aria-pressed={entry?.status === 'met'}
                  disabled={!editable}
                  onClick={() =>
                    onMeal(date, meal, entry?.status === 'met' ? null : 'met')
                  }
                >
                  Sí
                </button>
                <button
                  type='button'
                  className={`choice ${entry?.status === 'missed' ? 'choice-missed' : ''}`}
                  aria-pressed={entry?.status === 'missed'}
                  disabled={!editable}
                  onClick={() =>
                    onMeal(
                      date,
                      meal,
                      entry?.status === 'missed' ? null : 'missed'
                    )
                  }
                >
                  No
                </button>
              </div>
            </article>
          )
        })}
        {meals.length === 0 && (
          <p className='empty-copy'>
            Este día todavía no tiene plan de comidas.
          </p>
        )}
      </div>

      <article className={`workout-card ${workout ? 'is-done' : ''}`}>
        <div className='workout-icon'>
          <DumbbellIcon />
        </div>
        <div className='workout-copy'>
          <strong>{workout ? '¡Ahhh, un gim!' : 'Entrenamiento'}</strong>
          <p>
            {workout
              ? workout.workoutType || 'Registrado'
              : 'Un toque y queda marcado.'}
          </p>
          {workout && celebrateKey === workout.id && (
            <span className='celebration-text'>Rosquilla ganada</span>
          )}
        </div>
        <button
          type='button'
          className={workout ? 'secondary-action' : 'primary-action'}
          disabled={!editable}
          onClick={() => onWorkout(date, !workout)}
        >
          {workout ? 'Deshacer' : 'Entrené'}
        </button>
      </article>

      {editable && (
        <div className='details-block'>
          <button
            type='button'
            className='text-action'
            onClick={() => setDetailsOpen((open) => !open)}
          >
            {detailsOpen ? 'Ocultar detalles' : 'Tipo y nota opcional'}
          </button>
          {detailsOpen && (
            <form
              className='details-form'
              onSubmit={(event) => {
                event.preventDefault()
                onWorkoutDetails(date, workoutType, note)
              }}
            >
              <label>
                Tipo
                <input
                  value={workoutType}
                  onChange={(event) => setWorkoutType(event.target.value)}
                  maxLength={40}
                  placeholder='Pierna, corrida…'
                />
              </label>
              <label>
                Nota
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={240}
                  placeholder='Cómo se sintió'
                />
              </label>
              <button className='secondary-action' type='submit'>
                Guardar detalle
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  )
}
