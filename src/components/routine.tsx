import { useState } from 'react'
import {
  addTemplate,
  removeTemplate,
  setWeekdayRoutine,
  updateTemplate,
  useRoutineState,
  weekdayIndex,
  type RoutineTemplate,
  type TemplateExercise
} from '../lib/routines'
import { Sheet } from './Sheet'
import { CheckIcon, ChevronIcon, TrashIcon } from './icons'

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function kg(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}kg`
}

function NumField({
  label,
  value,
  step = 1,
  min,
  max,
  format = String,
  onChange
}: {
  label: string
  value: number
  step?: number
  min: number
  max: number
  format?: (value: number) => string
  onChange: (value: number) => void
}) {
  return (
    <label className='routine-field'>
      <span>{label}</span>
      <div className='stepper'>
        <button
          type='button'
          aria-label={`Menos ${label}`}
          disabled={value - step < min}
          onClick={() => onChange(value - step)}
        >
          −
        </button>
        <strong>{format(value)}</strong>
        <button
          type='button'
          aria-label={`Más ${label}`}
          disabled={value + step > max}
          onClick={() => onChange(value + step)}
        >
          +
        </button>
      </div>
    </label>
  )
}

function ExerciseFields({
  exercise,
  onChange
}: {
  exercise: TemplateExercise
  onChange: (patch: Partial<TemplateExercise>) => void
}) {
  return (
    <div className='routine-fields'>
      <NumField
        label='Series'
        value={exercise.sets}
        min={1}
        max={10}
        onChange={(sets) => onChange({ sets })}
      />
      <NumField
        label='Reps'
        value={exercise.reps}
        min={1}
        max={99}
        onChange={(reps) => onChange({ reps })}
      />
      <NumField
        label='Peso'
        value={exercise.weight}
        step={2.5}
        min={0}
        max={300}
        format={kg}
        onChange={(weight) => onChange({ weight })}
      />
    </div>
  )
}

type DayExercise = TemplateExercise & {
  id: number
  done: boolean[]
  repsDone: number[]
  skipped: boolean
}

function toDay(template: RoutineTemplate): DayExercise[] {
  return template.exercises.map((exercise, index) => ({
    ...exercise,
    id: index + 1,
    done: Array<boolean>(exercise.sets).fill(false),
    repsDone: Array<number>(exercise.sets).fill(exercise.reps),
    skipped: false
  }))
}

function toTemplate(day: DayExercise[]): TemplateExercise[] {
  return day.map(({ name, sets, reps, weight }) => ({
    name,
    sets,
    reps,
    weight
  }))
}

export function RoutinePanel({
  date,
  onComplete,
  onClose
}: {
  date?: string
  onComplete?: () => void
  onClose?: () => void
}) {
  const { templates, weekday } = useRoutineState()
  const suggestedId = weekday[
    weekdayIndex(date ? new Date(`${date}T12:00:00`) : new Date())
  ]
  const [phase, setPhase] = useState<'pick' | 'session' | 'list' | 'done'>(
    'pick'
  )
  const [pickedId, setPickedId] = useState<number | 'free' | null>(
    suggestedId ?? null
  )
  const [activeId, setActiveId] = useState<number | null>(null)
  const [day, setDay] = useState<DayExercise[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<TemplateExercise>({
    name: '',
    sets: 3,
    reps: 10,
    weight: 20
  })
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const active = templates.find((item) => item.id === activeId)
  const suggested = templates.find((item) => item.id === suggestedId)
  const nextId = day.reduce((max, item) => Math.max(max, item.id), 0) + 1
  const currentIndex = day.findIndex(
    (item) => !item.skipped && !item.done.every(Boolean)
  )
  const allResolved = day.length > 0 && currentIndex === -1
  const current = currentIndex >= 0 ? day[currentIndex] : null
  const setIndex = current ? current.done.indexOf(false) : -1
  const setsDone = day.reduce(
    (total, item) => total + item.done.filter(Boolean).length,
    0
  )
  const skippedCount = day.filter((item) => item.skipped).length

  function start() {
    if (pickedId === 'free') {
      setActiveId(null)
      setDay([])
      setPhase('list')
      setAdding(true)
      return
    }
    const template = templates.find((item) => item.id === pickedId)
    if (!template) return
    setActiveId(template.id)
    setDay(toDay(template))
    setEditingId(null)
    setSaveOpen(false)
    setPhase('session')
  }

  function patch(id: number, changes: Partial<DayExercise>) {
    setDay((items) =>
      items.map((item) => {
        if (item.id !== id) return item
        const merged = { ...item, ...changes }
        if (changes.sets !== undefined) {
          merged.done = Array.from(
            { length: changes.sets },
            (_, index) => item.done[index] ?? false
          )
          merged.repsDone = Array.from(
            { length: changes.sets },
            (_, index) => item.repsDone[index] ?? item.reps
          )
        }
        if (changes.reps !== undefined) {
          merged.repsDone = merged.repsDone.map((logged) =>
            Math.min(logged, changes.reps!)
          )
        }
        return merged
      })
    )
  }

  function completeSet() {
    if (!current || setIndex < 0) return
    patch(current.id, {
      done: current.done.map((flag, index) =>
        index === setIndex ? true : flag
      )
    })
  }

  function adjustReps(delta: number) {
    if (!current || setIndex < 0) return
    patch(current.id, {
      repsDone: current.repsDone.map((logged, index) =>
        index === setIndex ? Math.max(0, logged + delta) : logged
      )
    })
  }

  function toggleSet(id: number, index: number) {
    setDay((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              done: item.done.map((flag, i) => (i === index ? !flag : flag))
            }
          : item
      )
    )
  }

  function move(id: number, delta: number) {
    setDay((items) => {
      const from = items.findIndex((item) => item.id === id)
      const to = from + delta
      if (from < 0 || to < 0 || to >= items.length) return items
      const next = items.slice()
      ;[next[from], next[to]] = [next[to], next[from]]
      return next
    })
  }

  function add() {
    const name = draft.name.trim()
    if (!name) return
    setDay((items) => [
      ...items,
      {
        ...draft,
        name,
        id: nextId,
        done: Array<boolean>(draft.sets).fill(false),
        repsDone: Array<number>(draft.sets).fill(draft.reps),
        skipped: false
      }
    ])
    setDraft({ name: '', sets: 3, reps: 10, weight: 20 })
    setAdding(false)
  }

  function saveOverwrite() {
    if (!active) return
    updateTemplate(active.id, { exercises: toTemplate(day) })
    setSaveOpen(false)
  }

  function saveNew() {
    const name = saveName.trim()
    if (!name) return
    setActiveId(addTemplate(name, toTemplate(day)))
    setSaveOpen(false)
    setSaveName('')
  }

  function finish() {
    setPhase('done')
    onComplete?.()
  }

  const head = (
    <div className='run-head'>
      {phase !== 'pick' ? (
        <button
          type='button'
          className='btn-link'
          onClick={() => setPhase('pick')}
        >
          Rutinas
        </button>
      ) : (
        <span />
      )}
      <strong>{active?.name ?? 'Libre'}</strong>
      {phase === 'session' ? (
        <button
          type='button'
          className='btn-link'
          onClick={() => setPhase('list')}
        >
          Lista
        </button>
      ) : phase === 'list' && day.length > 0 ? (
        <button
          type='button'
          className='btn-link'
          onClick={() => setPhase('session')}
        >
          Sesión
        </button>
      ) : (
        <span />
      )}
    </div>
  )

  const finishButton = (
    <button
      type='button'
      className='btn btn-primary btn-block'
      disabled={day.length === 0}
      onClick={finish}
    >
      Completar entreno
    </button>
  )

  if (phase === 'done') {
    return (
      <div className='stack'>
        <div className='run-done'>
          <span className='run-done-check'>
            <CheckIcon />
          </span>
          <h3>Entreno completado</h3>
          <p>
            {day.length - skippedCount} ejercicios · {setsDone} series
            {skippedCount > 0 ? ` · ${skippedCount} omitidos` : ''}
          </p>
          <p className='routine-note'>
            {onComplete
              ? 'El día quedó marcado como entrenado.'
              : 'Prueba visual — en la app real marcaría el día como entrenado.'}
          </p>
          <button
            type='button'
            className='btn btn-primary btn-block'
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'pick') {
    return (
      <div className='stack'>
        <p className='routine-note'>
          Prueba visual — el entreno no se guarda al cerrar. Las rutinas se
          configuran en Plan.
        </p>
        {suggested && (
          <p className='run-hint'>
            Hoy toca <strong>{suggested.name}</strong>
          </p>
        )}
        <div className='routine-chips' role='group' aria-label='Rutinas'>
          {templates.map((template) => (
            <button
              key={template.id}
              type='button'
              className={`routine-chip${template.id === pickedId ? ' is-active' : ''}`}
              aria-pressed={template.id === pickedId}
              onClick={() => setPickedId(template.id)}
            >
              {template.name}
            </button>
          ))}
          <button
            type='button'
            className={`routine-chip${pickedId === 'free' ? ' is-active' : ''}`}
            aria-pressed={pickedId === 'free'}
            onClick={() => setPickedId('free')}
          >
            Libre
          </button>
        </div>
        <button
          type='button'
          className='btn btn-primary btn-block'
          disabled={pickedId === null}
          onClick={start}
        >
          Iniciar
        </button>
      </div>
    )
  }

  if (phase === 'session') {
    return (
      <div className='stack'>
        {head}
        {day.length === 0 ? (
          <>
            <p className='routine-note'>
              Entreno libre — añade ejercicios desde la lista.
            </p>
            <button
              type='button'
              className='btn btn-block'
              onClick={() => {
                setPhase('list')
                setAdding(true)
              }}
            >
              + Añadir ejercicio
            </button>
          </>
        ) : allResolved ? (
          <>
            <div className='run-done'>
              <span className='run-done-check'>
                <CheckIcon />
              </span>
              <h3>Todo listo</h3>
              <p>
                {day.length - skippedCount} ejercicios · {setsDone} series
              </p>
            </div>
            {finishButton}
          </>
        ) : (
          current && (
            <>
              <p className='run-progress'>
                Ejercicio {currentIndex + 1} de{' '}
                {day.filter((item) => !item.skipped).length}
              </p>
              <div className='run-card'>
                <strong className='run-name'>{current.name}</strong>
                <p className='run-goal'>
                  Serie {setIndex + 1} de {current.sets} ·{' '}
                  {kg(current.weight)}
                </p>
                <div className='run-reps'>
                  <button
                    type='button'
                    aria-label='Menos repes'
                    disabled={current.repsDone[setIndex] <= 0}
                    onClick={() => adjustReps(-1)}
                  >
                    −
                  </button>
                  <div className='run-count'>
                    <strong>{current.repsDone[setIndex]}</strong>
                    <span>reps</span>
                  </div>
                  <button
                    type='button'
                    aria-label='Más repes'
                    onClick={() => adjustReps(1)}
                  >
                    +
                  </button>
                </div>
                <div className='run-sets' aria-hidden='true'>
                  {current.done.map((flag, index) => (
                    <span
                      key={index}
                      className={`run-dot${flag ? ' is-done' : ''}${index === setIndex ? ' is-current' : ''}`}
                    />
                  ))}
                </div>
              </div>
              <div className='run-actions'>
                <button
                  type='button'
                  className='btn'
                  onClick={() => patch(current.id, { skipped: true })}
                >
                  Omitir
                </button>
                <button
                  type='button'
                  className='btn btn-primary'
                  onClick={completeSet}
                >
                  {setIndex === current.sets - 1
                    ? 'Completar ejercicio'
                    : '✓ Serie'}
                </button>
              </div>
              <button
                type='button'
                className='btn-link'
                onClick={() => {
                  setPhase('list')
                  setAdding(true)
                }}
              >
                + Añadir ejercicio
              </button>
              {finishButton}
            </>
          )
        )}
      </div>
    )
  }

  return (
    <div className='stack'>
      {head}
      <ul className='routine-list'>
        {day.map((exercise, index) => {
          const editing = editingId === exercise.id
          return (
            <li
              className={`routine-ex${exercise.skipped ? ' is-skipped' : ''}`}
              key={exercise.id}
            >
              <div className='routine-head'>
                <div className='routine-copy'>
                  <strong>{exercise.name}</strong>
                  <p>
                    {exercise.skipped
                      ? 'Omitido hoy'
                      : `${exercise.sets} × ${exercise.reps} · ${kg(exercise.weight)} · ${exercise.done.filter(Boolean).length}/${exercise.sets} hechas`}
                  </p>
                </div>
                <div className='routine-tools'>
                  <button
                    type='button'
                    className='btn-link'
                    onClick={() =>
                      patch(exercise.id, { skipped: !exercise.skipped })
                    }
                  >
                    {exercise.skipped ? 'Incluir' : 'Omitir'}
                  </button>
                  <button
                    type='button'
                    className='btn-link'
                    onClick={() => setEditingId(editing ? null : exercise.id)}
                  >
                    {editing ? 'Listo' : 'Editar'}
                  </button>
                </div>
              </div>
              <div
                className='routine-sets'
                role='group'
                aria-label={`Series de ${exercise.name}`}
              >
                {exercise.done.map((flag, setIndex) => (
                  <button
                    key={setIndex}
                    type='button'
                    className={`set-pill${flag ? ' is-done' : ''}`}
                    aria-pressed={flag}
                    aria-label={`Serie ${setIndex + 1}${flag ? ' hecha' : ''}`}
                    disabled={exercise.skipped}
                    onClick={() => toggleSet(exercise.id, setIndex)}
                  >
                    {setIndex + 1}
                  </button>
                ))}
                <span className='routine-moves'>
                  <button
                    type='button'
                    className='routine-move is-up'
                    aria-label='Subir'
                    disabled={index === 0}
                    onClick={() => move(exercise.id, -1)}
                  >
                    <ChevronIcon />
                  </button>
                  <button
                    type='button'
                    className='routine-move'
                    aria-label='Bajar'
                    disabled={index === day.length - 1}
                    onClick={() => move(exercise.id, 1)}
                  >
                    <ChevronIcon />
                  </button>
                </span>
              </div>
              {editing && (
                <ExerciseFields
                  exercise={exercise}
                  onChange={(changes) => patch(exercise.id, changes)}
                />
              )}
            </li>
          )
        })}
        {adding ? (
          <li className='routine-ex'>
            <input
              className='free-note'
              value={draft.name}
              placeholder='Ejercicio'
              maxLength={60}
              autoFocus
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, name: event.target.value }))
              }
            />
            <ExerciseFields
              exercise={draft}
              onChange={(changes) =>
                setDraft((prev) => ({ ...prev, ...changes }))
              }
            />
            <div className='routine-add-actions'>
              <button
                type='button'
                className='btn-link'
                onClick={() => setAdding(false)}
              >
                Cancelar
              </button>
              <button
                type='button'
                className='btn btn-primary'
                disabled={!draft.name.trim()}
                onClick={add}
              >
                Añadir
              </button>
            </div>
          </li>
        ) : (
          <li>
            <button
              type='button'
              className='btn btn-block'
              onClick={() => setAdding(true)}
            >
              + Añadir ejercicio
            </button>
          </li>
        )}
      </ul>
      {day.length > 0 &&
        (saveOpen ? (
          <div className='routine-savebox'>
            {active && (
              <button
                type='button'
                className='btn'
                onClick={saveOverwrite}
              >
                Actualizar «{active.name}»
              </button>
            )}
            <div className='routine-savenew'>
              <input
                value={saveName}
                placeholder='Nombre nueva rutina'
                maxLength={40}
                onChange={(event) => setSaveName(event.target.value)}
              />
              <button
                type='button'
                className='btn btn-primary'
                disabled={!saveName.trim()}
                onClick={saveNew}
              >
                Como nueva
              </button>
            </div>
            <button
              type='button'
              className='btn-link'
              onClick={() => setSaveOpen(false)}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type='button'
            className='btn'
            onClick={() => setSaveOpen(true)}
          >
            Guardar rutina
          </button>
        ))}
      {finishButton}
    </div>
  )
}

export function RoutineManager() {
  const { templates, weekday } = useRoutineState()
  const [open, setOpen] = useState(false)
  const assigned = DAY_LABELS.map((label, index) => {
    const template = templates.find((item) => item.id === weekday[index])
    return template ? `${label}: ${template.name}` : null
  })
    .filter(Boolean)
    .join(' · ')

  return (
    <fieldset className='routine-manager'>
      <legend>Rutinas de entrenamiento</legend>
      <p className='field-note'>
        {templates.length} rutina{templates.length === 1 ? '' : 's'}
        {assigned ? ` · ${assigned}` : ' · sin asignar'} — prueba visual, aún
        no se guarda con el plan.
      </p>
      <button
        type='button'
        className='btn'
        onClick={() => setOpen(true)}
      >
        Editar rutinas
      </button>
      {open && (
        <Sheet title='Rutinas' onClose={() => setOpen(false)}>
          <RoutineEditor />
        </Sheet>
      )}
    </fieldset>
  )
}

function RoutineEditor() {
  const { templates, weekday } = useRoutineState()
  const [selDay, setSelDay] = useState(() => weekdayIndex(new Date()))
  const [openId, setOpenId] = useState<number | null>(null)
  const [editEx, setEditEx] = useState<number | null>(null)
  const openTpl = templates.find((item) => item.id === openId)
  const editExercise =
    openTpl && editEx !== null ? openTpl.exercises[editEx] : undefined

  function patchExercise(
    template: RoutineTemplate,
    index: number,
    changes: Partial<TemplateExercise>
  ) {
    updateTemplate(template.id, {
      exercises: template.exercises.map((exercise, itemIndex) =>
        itemIndex === index ? { ...exercise, ...changes } : exercise
      )
    })
  }

  function templateName(id: number | null) {
    return templates.find((item) => item.id === id)?.name ?? 'Libre'
  }

  if (openTpl && editExercise && editEx !== null) {
    return (
      <div className='stack'>
        <div className='run-head'>
          <button
            type='button'
            className='btn-link'
            onClick={() => setEditEx(null)}
          >
            ← Ejercicios
          </button>
          <button
            type='button'
            className='btn btn-primary'
            onClick={() => setEditEx(null)}
          >
            Listo
          </button>
        </div>
        <input
          className='input-ghost'
          aria-label='Nombre del ejercicio'
          value={editExercise.name}
          placeholder='Ejercicio'
          maxLength={60}
          onChange={(event) =>
            patchExercise(openTpl, editEx, { name: event.target.value })
          }
        />
        <ExerciseFields
          exercise={editExercise}
          onChange={(changes) => patchExercise(openTpl, editEx, changes)}
        />
        <button
          type='button'
          className='btn-quiet'
          onClick={() => {
            updateTemplate(openTpl.id, {
              exercises: openTpl.exercises.filter(
                (_, index) => index !== editEx
              )
            })
            setEditEx(null)
          }}
        >
          Eliminar ejercicio
        </button>
      </div>
    )
  }

  if (openTpl) {
    return (
      <div className='stack'>
        <div className='run-head'>
          <button
            type='button'
            className='btn-link'
            onClick={() => setOpenId(null)}
          >
            ← Rutinas
          </button>
          <button
            type='button'
            className='btn btn-primary'
            onClick={() => setOpenId(null)}
          >
            Listo
          </button>
        </div>
        <input
          className='input-ghost'
          aria-label='Nombre de la rutina'
          value={openTpl.name}
          placeholder='Nombre de la rutina'
          maxLength={40}
          onChange={(event) =>
            updateTemplate(openTpl.id, { name: event.target.value })
          }
        />
        <ul className='tpl-exlist'>
          {openTpl.exercises.map((exercise, index) => (
            <li key={index}>
              <button
                type='button'
                className='tpl-ex-row'
                onClick={() => setEditEx(index)}
              >
                <strong>{exercise.name || 'Sin nombre'}</strong>
                <span>
                  {exercise.sets} × {exercise.reps} · {kg(exercise.weight)}
                </span>
                <ChevronIcon />
              </button>
            </li>
          ))}
        </ul>
        <button
          type='button'
          className='btn'
          onClick={() =>
            updateTemplate(openTpl.id, {
              exercises: [
                ...openTpl.exercises,
                { name: '', sets: 3, reps: 10, weight: 20 }
              ]
            })
          }
        >
          + ejercicio
        </button>
        <button
          type='button'
          className='btn-quiet'
          onClick={() => {
            removeTemplate(openTpl.id)
            setOpenId(null)
          }}
        >
          Eliminar rutina
        </button>
      </div>
    )
  }

  return (
    <div className='stack'>
      <p className='routine-note'>
        Asigna una rutina a cada día (opcional — en el día puedes escoger otra
        o ir libre) y edita los ejercicios de cada rutina. Prueba visual: aún
        no se guarda con el plan.
      </p>
      <div
        className='day-strip'
        role='group'
        aria-label='Días de la semana'
      >
        {DAY_LABELS.map((label, index) => (
          <button
            key={label}
            type='button'
            className={`day-chip${index === selDay ? ' is-active' : ''}${weekday[index] ? ' has-routine' : ''}`}
            aria-pressed={index === selDay}
            onClick={() => setSelDay(index)}
          >
            <span>{label}</span>
            <small>{templateName(weekday[index])}</small>
          </button>
        ))}
      </div>
      <div
        className='routine-chips'
        role='group'
        aria-label={`Rutina para ${DAY_LABELS[selDay]}`}
      >
        <button
          type='button'
          className={`routine-chip${weekday[selDay] === null ? ' is-active' : ''}`}
          aria-pressed={weekday[selDay] === null}
          onClick={() => setWeekdayRoutine(selDay, null)}
        >
          Libre
        </button>
        {templates.map((template) => (
          <button
            key={template.id}
            type='button'
            className={`routine-chip${weekday[selDay] === template.id ? ' is-active' : ''}`}
            aria-pressed={weekday[selDay] === template.id}
            onClick={() => setWeekdayRoutine(selDay, template.id)}
          >
            {template.name}
          </button>
        ))}
      </div>
      <ul className='tpl-list'>
        {templates.map((template) => (
          <li className='tpl-row' key={template.id}>
            <button
              type='button'
              className='tpl-open'
              onClick={() => setOpenId(template.id)}
            >
              <strong>{template.name}</strong>
              <span>
                {template.exercises.length} ejercicio
                {template.exercises.length === 1 ? '' : 's'}
              </span>
              <ChevronIcon />
            </button>
            <button
              type='button'
              className='icon-flat'
              aria-label={`Eliminar ${template.name}`}
              onClick={() => removeTemplate(template.id)}
            >
              <TrashIcon />
            </button>
          </li>
        ))}
      </ul>
      <button
        type='button'
        className='btn'
        onClick={() => {
          const id = addTemplate('Nueva rutina', [])
          setOpenId(id)
        }}
      >
        + Nueva rutina
      </button>
    </div>
  )
}
