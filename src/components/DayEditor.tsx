import { formatDay, monthEnd, monthStart } from '../lib/dates'
import {
  activePlanForDate,
  countFreeMeals,
  EXTRA_LEVEL_POINTS,
  EXTRA_MONTH_CAP,
  extraEntryFor,
  freeMealEntryFor,
  mealEntryFor,
  mealsForDate,
  sumExtraPoints,
  workoutForDate
} from '../lib/scoring'
import type {
  Dashboard,
  ExtraLevel,
  MealSlot,
  MealStatus
} from '../lib/types'
import {
  CheckIcon,
  CloseIcon,
  DumbbellIcon,
  ExtraIcon,
  TreatIcon
} from './icons'

const EXTRA_LEVELS: Array<{ id: ExtraLevel; label: string; color: string }> = [
  { id: 1, label: 'Suave', color: 'var(--mint)' },
  { id: 2, label: 'Media', color: 'var(--yellow)' },
  { id: 3, label: 'Fuerte', color: 'var(--coral)' }
]

export function DayEditor({
  dashboard,
  profileId,
  date,
  editable,
  celebrateKey,
  onMeal,
  onWorkout,
  onFree,
  onExtra,
  onOpenDetails,
  onOpenRoutine
}: {
  dashboard: Dashboard
  profileId: string
  date: string
  editable: boolean
  celebrateKey?: string
  onMeal: (date: string, slot: MealSlot, status: MealStatus | null) => void
  onWorkout: (date: string, done: boolean) => void
  onFree: (date: string, count: number, note: string | null) => void
  onExtra: (
    date: string,
    entry: {
      level: ExtraLevel
      note: string | null
    } | null
  ) => void
  onOpenDetails: (date: string) => void
  onOpenRoutine: () => void
}) {
  const meals = mealsForDate(dashboard, profileId, date)
  const workout = workoutForDate(dashboard, profileId, date)
  const celebrating = Boolean(workout && celebrateKey === workout.id)
  const freeQuota =
    activePlanForDate(dashboard, profileId, date)?.freeMealsPerMonth ?? 0
  const free = freeMealEntryFor(dashboard, profileId, date)
  const monthKey = date.slice(0, 7)
  const freeUsed = countFreeMeals(
    dashboard,
    profileId,
    monthStart(monthKey),
    monthEnd(monthKey)
  )
  const freeExcess = Math.max(0, freeUsed - freeQuota)
  const extra = extraEntryFor(dashboard, profileId, date)
  const extraPoints = sumExtraPoints(
    dashboard,
    profileId,
    monthStart(monthKey),
    monthEnd(monthKey)
  )
  const extraLevel = EXTRA_LEVELS.find((item) => item.id === extra?.level)

  return (
    <section
      className='day-editor'
      aria-label={`Registro de ${formatDay(date)}`}
    >
      <h2 className='block-title'>Comidas</h2>
      <ul className='meal-list'>
        {meals.map((meal, index) => {
          const entry = mealEntryFor(dashboard, profileId, meal.id, date)
          return (
            <li
              className={`meal-row ${entry ? `is-${entry.status}` : ''}`}
              key={meal.id}
              style={{ ['--i' as string]: index }}
            >
              <div className='meal-copy'>
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
                  className='choice choice-met'
                  aria-pressed={entry?.status === 'met'}
                  disabled={!editable}
                  onClick={() =>
                    onMeal(date, meal, entry?.status === 'met' ? null : 'met')
                  }
                >
                  <CheckIcon />
                  Sí
                </button>
                <button
                  type='button'
                  className='choice choice-missed'
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
                  <CloseIcon />
                  No
                </button>
              </div>
            </li>
          )
        })}
        {meals.length === 0 && (
          <li className='empty-copy'>
            Este día todavía no tiene plan de comidas.
          </li>
        )}
      </ul>

      <h2 className='block-title'>Entrenamiento</h2>
      <div className={`workout-card ${workout ? 'is-done' : ''}`}>
        <span
          className={`workout-icon${celebrating ? ' is-celebrating' : ''}`}
          aria-hidden='true'
        >
          <DumbbellIcon />
          {workout && (
            <span className='workout-check'>
              <CheckIcon />
            </span>
          )}
        </span>
        <div className='workout-copy'>
          <strong>{workout ? '¡Ahhh, un gim!' : 'Sin registrar'}</strong>
          <p>
            {workout
              ? [workout.workoutType, workout.note]
                  .filter(Boolean)
                  .join(' · ') || 'Registrado'
              : 'Un toque y queda marcado.'}
          </p>
        </div>
        <div className='workout-actions'>
          <button
            type='button'
            className={workout ? 'btn' : 'btn btn-primary'}
            disabled={!editable}
            onClick={() => onWorkout(date, !workout)}
          >
            {workout ? 'Deshacer' : 'Entrené'}
          </button>
          {editable && (
            <button
              type='button'
              className='btn-link'
              onClick={() => onOpenDetails(date)}
            >
              {workout ? 'Editar detalle' : 'Tipo y nota'}
            </button>
          )}
          <button type='button' className='btn-link' onClick={onOpenRoutine}>
            Rutina
          </button>
        </div>
      </div>

      <h2 className='block-title'>Comidas libres</h2>
      <div className={`workout-card free-card ${free ? 'is-done' : ''}`}>
        <span className='workout-icon' aria-hidden='true'>
          <TreatIcon />
        </span>
        <div className='workout-copy'>
          <strong>
            {free
              ? `${free.count} libre${free.count === 1 ? '' : 's'} hoy`
              : 'Sin libres hoy'}
          </strong>
          <p>
            {free?.note ? `${free.note} · ` : ''}
            {freeQuota > 0
              ? `${freeUsed} de ${freeQuota} usadas este mes${freeExcess > 0 ? ` · ${freeExcess} ${freeExcess === 1 ? 'cuenta' : 'cuentan'} como fallo` : ''}`
              : `${freeUsed} usadas este mes · cada una cuenta como fallo`}
          </p>
        </div>
        <div className='workout-actions'>
          <div className='stepper'>
            <button
              type='button'
              aria-label='Quitar comida libre'
              disabled={!editable || !free}
              onClick={() =>
                onFree(date, (free?.count ?? 0) - 1, free?.note ?? null)
              }
            >
              −
            </button>
            <strong>{free?.count ?? 0}</strong>
            <button
              type='button'
              aria-label='Añadir comida libre'
              disabled={!editable || (free?.count ?? 0) >= 9}
              onClick={() =>
                onFree(date, (free?.count ?? 0) + 1, free?.note ?? null)
              }
            >
              +
            </button>
          </div>
          {editable && (
            <input
              className='free-note'
              key={`${date}-${free?.version ?? 0}`}
              defaultValue={free?.note ?? ''}
              placeholder='¿Qué fue? (opcional)'
              maxLength={240}
              disabled={!free}
              onBlur={(event) => {
                const value = event.target.value.trim() || null
                if (free && value !== (free.note ?? null))
                  onFree(date, free.count, value)
              }}
            />
          )}
        </div>
      </div>

      <h2 className='block-title'>Actividad extra</h2>
      <div className={`workout-card extra-card ${extra ? 'is-done' : ''}`}>
        <span className='workout-icon' aria-hidden='true'>
          <ExtraIcon />
        </span>
        <div className='workout-copy'>
          <strong>
            {extra ? (
              <>
                <span
                  className='extra-level-dot'
                  style={{ background: extraLevel?.color }}
                  aria-hidden='true'
                />
                {`${extraLevel?.label ?? ''} · +${EXTRA_LEVEL_POINTS[extra.level] ?? 0}`}
              </>
            ) : (
              'Sin registrar'
            )}
          </strong>
          <div
            className='extra-bonus'
            role='img'
            aria-label={`Bonus del mes: +${extraPoints} de ${EXTRA_MONTH_CAP}`}
          >
            {Array.from({ length: EXTRA_MONTH_CAP }).map((_, i) => (
              <span
                key={i}
                className={
                  extraPoints >= i + 1 ? 'on' : extraPoints > i ? 'half' : ''
                }
              />
            ))}
          </div>
        </div>
        <div className='workout-actions extra-actions'>
          <div className='extra-slider'>
            <input
              type='range'
              min={0}
              max={3}
              step={1}
              value={extra?.level ?? 0}
              style={{
                ['--level' as string]: String(extra?.level ?? 0),
                ['--level-color' as string]: extraLevel?.color ?? 'var(--mint)'
              }}
              disabled={!editable}
              aria-label='Esfuerzo de la actividad extra'
              aria-valuetext={
                extra ? `${extraLevel?.label}` : 'Sin registrar'
              }
              onChange={(event) => {
                const level = Number(event.target.value) as 0 | ExtraLevel
                onExtra(
                  date,
                  level === 0
                    ? null
                    : { level, note: extra?.note ?? null }
                )
              }}
            />
            <div className='extra-slider-ticks' aria-hidden='true'>
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          {extra && editable && (
            <div className='extra-meta'>
              <input
                className='free-note'
                key={`${date}-${extra.version}`}
                defaultValue={extra.note ?? ''}
                placeholder='¿Qué fue? (opcional)'
                maxLength={240}
                onBlur={(event) => {
                  const value = event.target.value.trim() || null
                  if (value !== (extra.note ?? null))
                    onExtra(date, { ...extra, note: value })
                }}
              />
              <button
                type='button'
                className='btn-link'
                onClick={() => onExtra(date, null)}
              >
                Quitar
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
