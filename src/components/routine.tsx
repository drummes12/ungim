import { useRef, useState } from 'react'
import { weekdayIndex } from '../lib/routines'
import type {
  RoutineDay,
  RoutineDayExercise,
  RoutineExercise,
  RoutineTemplate
} from '../lib/types'
import { Sheet } from './Sheet'
import { NumField } from './fields'
import { CheckIcon, ChevronIcon, TrashIcon } from './icons'

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function kg(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}kg`
}

function ExerciseFields({
  exercise,
  onChange
}: {
  exercise: RoutineExercise
  onChange: (patch: Partial<RoutineExercise>) => void
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

type DayExercise = RoutineDayExercise

function applyExerciseChanges(
  item: DayExercise,
  changes: Partial<DayExercise>
): DayExercise {
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
}

function toDay(template: RoutineTemplate): DayExercise[] {
  return template.exercises.map((exercise, index) => ({
    ...exercise,
    name: exercise.name || 'Sin nombre',
    id: index + 1,
    done: Array<boolean>(exercise.sets).fill(false),
    repsDone: Array<number>(exercise.sets).fill(exercise.reps),
    skipped: false
  }))
}

function toTemplate(day: DayExercise[]): RoutineExercise[] {
  return day.map(({ name, sets, reps, weight }) => ({
    name,
    sets,
    reps,
    weight
  }))
}

export function RoutinePanel({
  date,
  templates,
  weekday,
  savedDay,
  onSaveDay,
  onSaveTemplate,
  onComplete,
  onClose
}: {
  date?: string
  templates: RoutineTemplate[]
  weekday: (string | null)[]
  savedDay: RoutineDay | null
  onSaveDay: (day: {
    routineId: string | null
    exercises: RoutineDayExercise[]
    completed: boolean
  }) => void
  onSaveTemplate: (
    templateId: string | null,
    name: string,
    exercises: RoutineExercise[]
  ) => string
  onComplete?: (routineName: string | null) => void
  onClose?: () => void
}) {
  const suggestedId = weekday[
    weekdayIndex(date ? new Date(`${date}T12:00:00`) : new Date())
  ]
  const [phase, setPhase] = useState<'pick' | 'session' | 'list' | 'done'>(
    savedDay?.completed
      ? 'done'
      : savedDay && savedDay.exercises.length > 0
        ? 'session'
        : 'pick'
  )
  const [pickedId, setPickedId] = useState<string | 'free' | null>(
    savedDay ? (savedDay.routineId ?? 'free') : (suggestedId ?? null)
  )
  const [activeId, setActiveId] = useState<string | null>(
    savedDay?.routineId ?? null
  )
  const [day, setDay] = useState<DayExercise[]>(savedDay?.exercises ?? [])
  const [completed, setCompleted] = useState(savedDay?.completed ?? false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [movedId, setMovedId] = useState<number | null>(null)
  const moveTimer = useRef<number | undefined>(undefined)
  const [listDraft, setListDraft] = useState<DayExercise[] | null>(null)
  const [listSaved, setListSaved] = useState(false)
  const savedTimer = useRef<number | undefined>(undefined)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<RoutineExercise>({
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

  function commit(
    next: DayExercise[],
    overrides?: { routineId?: string | null; completed?: boolean }
  ) {
    const routineId =
      overrides?.routineId !== undefined ? overrides.routineId : activeId
    const done = overrides?.completed !== undefined ? overrides.completed : completed
    setDay(next)
    if (routineId !== activeId) setActiveId(routineId)
    if (done !== completed) setCompleted(done)
    if (next.length === 0 && !done && !savedDay) return
    onSaveDay({ routineId, exercises: next, completed: done })
  }

  function start() {
    if (pickedId === 'free') {
      setPhase('list')
      setAdding(true)
      if (savedDay) commit([], { routineId: null, completed: false })
      return
    }
    const template = templates.find((item) => item.id === pickedId)
    if (!template) return
    setEditingId(null)
    setSaveOpen(false)
    commit(toDay(template), { routineId: template.id, completed: false })
    setPhase('session')
  }

  function patch(id: number, changes: Partial<DayExercise>) {
    commit(
      day.map((item) =>
        item.id === id ? applyExerciseChanges(item, changes) : item
      )
    )
  }

  // List phase edits stay in a local draft: structure changes (reorder, add,
  // remove, field edits, set pills) don't sync until "Guardar cambios" sends
  // one upsert-routine-day with the whole snapshot.
  function updateDraft(updater: (items: DayExercise[]) => DayExercise[]) {
    setListDraft((prev) => updater(prev ?? day))
    setListSaved(false)
  }

  function patchDraft(id: number, changes: Partial<DayExercise>) {
    updateDraft((items) =>
      items.map((item) =>
        item.id === id ? applyExerciseChanges(item, changes) : item
      )
    )
  }

  function toggleSetDraft(id: number, index: number) {
    updateDraft((items) =>
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

  function moveDraft(id: number, delta: number) {
    updateDraft((items) => {
      const from = items.findIndex((item) => item.id === id)
      const to = from + delta
      if (from < 0 || to < 0 || to >= items.length) return items
      const next = items.slice()
      ;[next[from], next[to]] = [next[to], next[from]]
      return next
    })
    setMovedId(id)
    window.clearTimeout(moveTimer.current)
    moveTimer.current = window.setTimeout(() => setMovedId(null), 900)
  }

  function addDraft() {
    const name = draft.name.trim()
    if (!name) return
    const nextIndex = (listDraft ?? day).reduce(
      (max, item) => Math.max(max, item.id),
      0
    )
    updateDraft((items) => [
      ...items,
      {
        ...draft,
        name,
        id: nextIndex + 1,
        done: Array<boolean>(draft.sets).fill(false),
        repsDone: Array<number>(draft.sets).fill(draft.reps),
        skipped: false
      }
    ])
    setDraft({ name: '', sets: 3, reps: 10, weight: 20 })
    setAdding(false)
  }

  function saveList() {
    if (listDraft === null) return
    commit(listDraft)
    setListDraft(null)
    setListSaved(true)
    window.clearTimeout(savedTimer.current)
    savedTimer.current = window.setTimeout(() => setListSaved(false), 1800)
  }

  function goPhase(next: typeof phase) {
    if (next !== 'list') setListDraft(null)
    setPhase(next)
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
    commit(
      day.map((item) =>
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
    const from = day.findIndex((item) => item.id === id)
    const to = from + delta
    if (from < 0 || to < 0 || to >= day.length) return
    const next = day.slice()
    ;[next[from], next[to]] = [next[to], next[from]]
    commit(next)
    setMovedId(id)
    window.clearTimeout(moveTimer.current)
    moveTimer.current = window.setTimeout(() => setMovedId(null), 900)
  }

  function add() {
    const name = draft.name.trim()
    if (!name) return
    commit([
      ...day,
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
    onSaveTemplate(active.id, active.name, toTemplate(listDraft ?? day))
    setSaveOpen(false)
  }

  function saveNew() {
    const name = saveName.trim()
    if (!name) return
    const newId = onSaveTemplate(null, name, toTemplate(listDraft ?? day))
    commit(listDraft ?? day, { routineId: newId })
    setListDraft(null)
    setSaveOpen(false)
    setSaveName('')
  }

  function finish() {
    commit(listDraft ?? day, { completed: true })
    setListDraft(null)
    setPhase('done')
    onComplete?.(active?.name ?? null)
  }

  const head = (
    <div className='run-head'>
      {phase !== 'pick' ? (
        <button
          type='button'
          className='btn-link'
          onClick={() => goPhase('pick')}
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
          onClick={() => goPhase('list')}
        >
          Lista
        </button>
      ) : phase === 'list' && day.length > 0 ? (
        <button
          type='button'
          className='btn-link'
          onClick={() => goPhase('session')}
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
            El día quedó marcado como entrenado
            {active?.name ? ` · Rutina: ${active.name}` : ''}.
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
          El progreso se guarda solo — cierra y retoma cuando quieras.{' '}
          {templates.length === 0
            ? 'Aún no tienes rutinas: créalas en Plan → Editar rutinas, o entrena en modo Libre.'
            : 'Las rutinas se configuran en Plan.'}
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
                goPhase('list')
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
                  goPhase('list')
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

  const listDay = listDraft ?? day

  return (
    <div className='stack'>
      {head}
      <p className='routine-note'>
        La sesión se guarda sola; los cambios de esta lista se aplican con
        Guardar.
      </p>
      <ul className='routine-list'>
        {listDay.map((exercise, index) => {
          const editing = editingId === exercise.id
          return (
            <li
              className={`routine-ex${exercise.skipped ? ' is-skipped' : ''}${movedId === exercise.id ? ' is-moving' : ''}`}
              key={exercise.id}
            >
              <div className='routine-head'>
                <div className='routine-copy'>
                  <strong>{exercise.name || 'Sin nombre'}</strong>
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
                      patchDraft(exercise.id, { skipped: !exercise.skipped })
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
                    onClick={() => toggleSetDraft(exercise.id, setIndex)}
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
                    onClick={() => moveDraft(exercise.id, -1)}
                  >
                    <ChevronIcon />
                  </button>
                  <button
                    type='button'
                    className='routine-move'
                    aria-label='Bajar'
                    disabled={index === listDay.length - 1}
                    onClick={() => moveDraft(exercise.id, 1)}
                  >
                    <ChevronIcon />
                  </button>
                </span>
              </div>
              {editing && (
                <ExerciseFields
                  exercise={exercise}
                  onChange={(changes) => patchDraft(exercise.id, changes)}
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
                onClick={addDraft}
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
      {listDraft !== null && (
        <div className='routine-savebar'>
          <p className='routine-dirty'>Cambios sin guardar</p>
          <div className='routine-saveactions'>
            <button
              type='button'
              className='btn-link'
              onClick={() => setListDraft(null)}
            >
              Descartar
            </button>
            <button
              type='button'
              className='btn btn-primary'
              onClick={saveList}
            >
              Guardar cambios
            </button>
          </div>
        </div>
      )}
      {listSaved && listDraft === null && (
        <p className='routine-saved'>Cambios guardados ✓</p>
      )}
      {listDay.length > 0 &&
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

export function RoutineManager({
  templates,
  weekday,
  onSaveTemplate,
  onDeleteTemplate,
  onSetWeekday
}: {
  templates: RoutineTemplate[]
  weekday: (string | null)[]
  onSaveTemplate: (
    templateId: string | null,
    name: string,
    exercises: RoutineExercise[]
  ) => string
  onDeleteTemplate: (templateId: string) => void
  onSetWeekday: (weekday: number, routineId: string | null) => void
}) {
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
        {assigned ? ` · ${assigned}` : ' · sin asignar'}
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
          <RoutineEditor
            templates={templates}
            weekday={weekday}
            onSaveTemplate={onSaveTemplate}
            onDeleteTemplate={onDeleteTemplate}
            onSetWeekday={onSetWeekday}
          />
        </Sheet>
      )}
    </fieldset>
  )
}

function RoutineEditor({
  templates,
  weekday,
  onSaveTemplate,
  onDeleteTemplate,
  onSetWeekday
}: {
  templates: RoutineTemplate[]
  weekday: (string | null)[]
  onSaveTemplate: (
    templateId: string | null,
    name: string,
    exercises: RoutineExercise[]
  ) => string
  onDeleteTemplate: (templateId: string) => void
  onSetWeekday: (weekday: number, routineId: string | null) => void
}) {
  const [selDay, setSelDay] = useState(() => weekdayIndex(new Date()))
  const [openId, setOpenId] = useState<string | null>(null)
  const [editEx, setEditEx] = useState<number | null>(null)
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [exNameDraft, setExNameDraft] = useState<string | null>(null)
  const openTpl = templates.find((item) => item.id === openId)
  const editExercise =
    openTpl && editEx !== null ? openTpl.exercises[editEx] : undefined

  function patchExercise(
    template: RoutineTemplate,
    index: number,
    changes: Partial<RoutineExercise>
  ) {
    onSaveTemplate(
      template.id,
      template.name,
      template.exercises.map((exercise, itemIndex) =>
        itemIndex === index ? { ...exercise, ...changes } : exercise
      )
    )
  }

  function commitName() {
    const name = nameDraft?.trim()
    setNameDraft(null)
    if (!openTpl || name === undefined || name === openTpl.name) return
    if (!name) return
    onSaveTemplate(openTpl.id, name, openTpl.exercises)
  }

  function commitExName() {
    const name = exNameDraft?.trim()
    setExNameDraft(null)
    if (!openTpl || editEx === null || name === undefined) return
    const exercise = openTpl.exercises[editEx]
    if (!exercise || name === exercise.name) return
    patchExercise(openTpl, editEx, { name })
  }

  function templateName(id: string | null) {
    return templates.find((item) => item.id === id)?.name ?? 'Libre'
  }

  if (openTpl && editExercise && editEx !== null) {
    return (
      <div className='stack'>
        <div className='run-head'>
          <button
            type='button'
            className='btn-link'
            onClick={() => {
              commitExName()
              setEditEx(null)
            }}
          >
            ← Ejercicios
          </button>
          <button
            type='button'
            className='btn btn-primary'
            onClick={() => {
              commitExName()
              setEditEx(null)
            }}
          >
            Listo
          </button>
        </div>
        <input
          aria-label='Nombre del ejercicio'
          value={exNameDraft ?? editExercise.name}
          placeholder='Ejercicio'
          maxLength={60}
          onChange={(event) => setExNameDraft(event.target.value)}
          onBlur={commitExName}
        />
        <ExerciseFields
          exercise={editExercise}
          onChange={(changes) => patchExercise(openTpl, editEx, changes)}
        />
        <button
          type='button'
          className='btn-quiet'
          onClick={() => {
            setExNameDraft(null)
            onSaveTemplate(
              openTpl.id,
              openTpl.name,
              openTpl.exercises.filter((_, index) => index !== editEx)
            )
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
            onClick={() => {
              commitName()
              setOpenId(null)
            }}
          >
            ← Rutinas
          </button>
          <button
            type='button'
            className='btn btn-primary'
            onClick={() => {
              commitName()
              setOpenId(null)
            }}
          >
            Listo
          </button>
        </div>
        <input
          aria-label='Nombre de la rutina'
          value={nameDraft ?? openTpl.name}
          placeholder='Nombre de la rutina'
          maxLength={40}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={commitName}
        />
        <ul className='tpl-exlist'>
          {openTpl.exercises.map((exercise, index) => (
            <li key={index}>
              <button
                type='button'
                className='tpl-ex-row'
                onClick={() => {
                  commitName()
                  setEditEx(index)
                }}
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
            onSaveTemplate(openTpl.id, openTpl.name, [
              ...openTpl.exercises,
              { name: '', sets: 3, reps: 10, weight: 20 }
            ])
          }
        >
          + ejercicio
        </button>
        <button
          type='button'
          className='btn-quiet'
          onClick={() => {
            onDeleteTemplate(openTpl.id)
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
        o ir libre) y edita los ejercicios de cada rutina.
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
          onClick={() => onSetWeekday(selDay, null)}
        >
          Libre
        </button>
        {templates.map((template) => (
          <button
            key={template.id}
            type='button'
            className={`routine-chip${weekday[selDay] === template.id ? ' is-active' : ''}`}
            aria-pressed={weekday[selDay] === template.id}
            onClick={() => onSetWeekday(selDay, template.id)}
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
              onClick={() => onDeleteTemplate(template.id)}
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
          const id = onSaveTemplate(null, 'Nueva rutina', [])
          setOpenId(id)
        }}
      >
        + Nueva rutina
      </button>
    </div>
  )
}
