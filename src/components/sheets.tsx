import { useState, type ComponentType, type FormEvent } from 'react'
import { formatMonth, monthEnd } from '../lib/dates'
import { isStandaloneMode } from '../lib/pwa'
import { computeMonthScore } from '../lib/scoring'
import type { Dashboard, Profile, WorkoutEntry } from '../lib/types'
import { Avatar } from './Avatar'
import { DuelBar } from './charts'
import {
  CalendarIcon,
  CheckIcon,
  ChevronIcon,
  CloudCheckIcon,
  CloudOffIcon,
  DonutIcon,
  DumbbellIcon,
  ExtraIcon,
  HomeIcon,
  TreatIcon,
  TrophyIcon
} from './icons'

export function WorkoutDetailsForm({
  workout,
  onSubmit
}: {
  workout: WorkoutEntry | null
  onSubmit: (workoutType: string, note: string) => void
}) {
  const [workoutType, setWorkoutType] = useState(workout?.workoutType ?? '')
  const [note, setNote] = useState(workout?.note ?? '')

  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit(workoutType, note)
  }

  return (
    <form className='stack' onSubmit={submit}>
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
      <button className='btn btn-primary btn-block' type='submit'>
        {workout ? 'Guardar detalle' : 'Marcar entrenamiento'}
      </button>
    </form>
  )
}

export function ConfirmMonthForm({
  dashboard,
  monthKey,
  online,
  pendingCount,
  onConfirm,
  onDone
}: {
  dashboard: Dashboard
  monthKey: string
  online: boolean
  pendingCount: number
  onConfirm: (monthKey: string) => Promise<void>
  onDone: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const result = computeMonthScore(dashboard, monthKey, monthEnd(monthKey))
  const confirmed = dashboard.months[monthKey]?.confirmedBy ?? []
  const blocked = !online || pendingCount > 0

  async function confirm() {
    setSaving(true)
    setError(null)
    try {
      await onConfirm(monthKey)
      onDone()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'No se pudo confirmar el mes.'
      )
      setSaving(false)
    }
  }

  return (
    <div className='stack'>
      <p className='page-sub'>
        Resultado de {formatMonth(monthKey)}. Cuando ambos confirmen, el mes se
        cierra y ya no se puede editar.
      </p>
      <DuelBar
        participants={result.participants}
        winnerIds={result.winnerIds}
      />
      <p className='field-note'>
        Confirmado por {confirmed.length} de {dashboard.profiles.length}.
      </p>
      {blocked && (
        <p className='field-note' role='status'>
          Sincroniza los registros pendientes antes de cerrar.
        </p>
      )}
      {error && (
        <p className='form-error' role='alert'>
          {error}
        </p>
      )}
      <div className='sheet-actions'>
        <button className='btn' type='button' onClick={onDone}>
          Todavía no
        </button>
        <button
          className='btn btn-primary'
          type='button'
          disabled={blocked || saving}
          onClick={() => void confirm()}
        >
          {saving ? 'Confirmando…' : 'Confirmar y cerrar'}
        </button>
      </div>
    </div>
  )
}

const helpTopics: Array<{
  title: string
  Icon: ComponentType<{ filled?: boolean; className?: string }>
  body: string
}> = [
  {
    title: 'El día',
    Icon: HomeIcon,
    body: 'En Hoy registras comidas, entrenamiento y libres. Desde Historial puedes abrir y corregir cualquier día mientras su mes siga abierto.'
  },
  {
    title: 'Comidas',
    Icon: CheckIcon,
    body: 'Cada comida del plan se marca Sí o No. Las cumplidas suman y las que fallan restan en la mitad de comidas del puntaje.'
  },
  {
    title: 'Comidas libres',
    Icon: TreatIcon,
    body: 'Antojos fuera de la dieta (postre, helado, picada); no reemplazan una comida, así que si una libre te hace saltar una comida del plan, márcala en No también. Tu plan define cuántas salen gratis al mes: cada una que pasa del cupo cuenta como comida fallida, y con cupo 0 todas cuentan.'
  },
  {
    title: 'Entrenamientos',
    Icon: DumbbellIcon,
    body: 'Tu plan marca cuántos días por semana toca entrenar; el objetivo del mes se prorratea. «Detalle» guarda el tipo de sesión y una nota.'
  },
  {
    title: 'Actividad extra',
    Icon: ExtraIcon,
    body: 'Lo que sumes por fuera del plan: una caminata, movilidad u otro esfuerzo. Es opcional y no cuenta como entreno ni afecta la semana perfecta. Mueve el control según el esfuerzo: suave +0.5, media +1, fuerte +2 — hasta +6 al mes de bonus.'
  },
  {
    title: 'Semana perfecta',
    Icon: DonutIcon,
    body: 'De lunes a domingo: todas las comidas cumplidas, el objetivo de entrenos y cero libres. Cada semana perfecta suma +2 de bonus (máximo +10) y una rosquilla.'
  },
  {
    title: 'El puntaje',
    Icon: TrophyIcon,
    body: 'Hasta 50 puntos por ejercicio (hechos ÷ objetivo del mes) más hasta 50 por comidas (cumplidas ÷ planificadas) más el bonus de rosquillas. La barra de La carrera muestra las tres partes.'
  },
  {
    title: 'El calendario',
    Icon: CalendarIcon,
    body: 'El relleno del día sube con las comidas cumplidas, el punto marca entrenamiento, el punto rosa marca libres y el rombo menta marca actividad extra. Un día glaseado es un día perfecto.'
  },
  {
    title: 'Cierre de mes',
    Icon: CloudCheckIcon,
    body: 'Cuando termina el mes ambos confirman el resultado; al confirmar los dos, el mes se congela y ya no admite cambios.'
  },
  {
    title: 'Sin internet',
    Icon: CloudOffIcon,
    body: 'Puedes registrar igual: los cambios quedan guardados en el dispositivo y se sincronizan solos cuando vuelve la conexión.'
  }
]

export function HelpPanel() {
  return (
    <div className='stack'>
      <p className='page-sub'>
        Todo lo que puedes registrar y cómo se calcula el marcador.
      </p>
      {helpTopics.map((topic, index) => (
        <details className='help-topic' key={topic.title} open={index === 0}>
          <summary>
            <topic.Icon />
            <span>{topic.title}</span>
            <ChevronIcon />
          </summary>
          <p>{topic.body}</p>
        </details>
      ))}
    </div>
  )
}

export function AccountPanel({
  profile,
  partner,
  onEditPlan,
  onInstall,
  onHelp,
  onSignOut
}: {
  profile: Profile | undefined
  partner: Profile | undefined
  onEditPlan: () => void
  onInstall: () => void
  onHelp: () => void
  onSignOut: () => void
}) {
  return (
    <div className='stack'>
      <div className='account-id'>
        <Avatar
          name={profile?.displayName ?? '?'}
          color={profile?.avatarColor ?? '#14110f'}
          size='lg'
        />
        <strong>{profile?.displayName ?? 'Tu cuenta'}</strong>
      </div>
      {partner && (
        <div className='rival-card'>
          <span className='field-note'>Compites contra</span>
          <div className='rival-id'>
            <span className='avatar-stack'>
              <Avatar
                name={profile?.displayName ?? '?'}
                color={profile?.avatarColor ?? '#14110f'}
                size='sm'
              />
              <Avatar
                name={partner.displayName}
                color={partner.avatarColor}
                size='sm'
              />
            </span>
            <strong>{partner.displayName}</strong>
          </div>
        </div>
      )}
      <button className='btn btn-block' type='button' onClick={onEditPlan}>
        Ajustar mi plan
      </button>
      <button className='btn btn-block' type='button' onClick={onHelp}>
        ¿Cómo funciona?
      </button>
      {!isStandaloneMode() && (
        <button className='btn btn-block' type='button' onClick={onInstall}>
          Instalar la app
        </button>
      )}
      <button className='btn btn-block' type='button' onClick={onSignOut}>
        Salir
      </button>
    </div>
  )
}

type TemplateExercise = {
  name: string
  sets: number
  reps: number
  weight: number
}

type RoutineTemplate = {
  id: number
  name: string
  exercises: TemplateExercise[]
}

type DayExercise = TemplateExercise & {
  id: number
  src: number
  done: boolean[]
  skipped: boolean
}

const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    id: 1,
    name: 'Pierna',
    exercises: [
      { name: 'Sentadilla', sets: 4, reps: 8, weight: 60 },
      { name: 'Prensa', sets: 4, reps: 10, weight: 90 },
      { name: 'Extensión de cuádriceps', sets: 3, reps: 12, weight: 30 },
      { name: 'Peso muerto rumano', sets: 3, reps: 10, weight: 50 }
    ]
  },
  {
    id: 2,
    name: 'Pecho y brazo',
    exercises: [
      { name: 'Press banca', sets: 4, reps: 10, weight: 50 },
      { name: 'Press inclinado', sets: 3, reps: 10, weight: 18 },
      { name: 'Fondos', sets: 3, reps: 12, weight: 0 },
      { name: 'Curl bíceps', sets: 3, reps: 12, weight: 12 }
    ]
  },
  {
    id: 3,
    name: 'Espalda',
    exercises: [
      { name: 'Dominadas', sets: 4, reps: 6, weight: 0 },
      { name: 'Remo con barra', sets: 4, reps: 10, weight: 40 },
      { name: 'Jalón al pecho', sets: 3, reps: 12, weight: 35 }
    ]
  }
]

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
  exercise: TemplateExercise & { done?: boolean[] }
  onChange: (patch: { sets?: number; reps?: number; weight?: number }) => void
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
        max={50}
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

export function RoutinePanel() {
  const [templates, setTemplates] = useState(ROUTINE_TEMPLATES)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [day, setDay] = useState<DayExercise[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saveToTemplate, setSaveToTemplate] = useState(false)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<TemplateExercise>({
    name: '',
    sets: 3,
    reps: 10,
    weight: 20
  })
  const active = templates.find((item) => item.id === activeId)
  const nextId = day.reduce((max, item) => Math.max(max, item.id), 0) + 1

  function apply(templateId: number) {
    const template = templates.find((item) => item.id === templateId)
    if (!template) return
    setActiveId(templateId)
    setEditingId(null)
    setDay(
      template.exercises.map((exercise, index) => ({
        ...exercise,
        id: index + 1,
        src: index,
        done: Array<boolean>(exercise.sets).fill(false),
        skipped: false
      }))
    )
  }

  function patch(id: number, changes: Partial<DayExercise>) {
    const exercise = day.find((item) => item.id === id)
    const merged = { ...exercise, ...changes } as DayExercise
    if (changes.sets !== undefined)
      merged.done = Array.from(
        { length: changes.sets },
        (_, i) => exercise?.done[i] ?? false
      )
    setDay((items) =>
      items.map((item) => (item.id === id ? { ...item, ...merged } : item))
    )
    if (saveToTemplate && exercise && exercise.src >= 0)
      setTemplates((items) =>
        items.map((item) =>
          item.id === activeId
            ? {
                ...item,
                exercises: item.exercises.map((entry, index) =>
                  index === exercise.src
                    ? {
                        name: exercise.name,
                        sets: changes.sets ?? exercise.sets,
                        reps: changes.reps ?? exercise.reps,
                        weight: changes.weight ?? exercise.weight
                      }
                    : entry
                )
              }
            : item
        )
      )
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

  function add() {
    const name = draft.name.trim()
    if (!name) return
    setDay((items) => [
      ...items,
      {
        ...draft,
        name,
        id: nextId,
        src: -1,
        done: Array<boolean>(draft.sets).fill(false),
        skipped: false
      }
    ])
    setDraft({ name: '', sets: 3, reps: 10, weight: 20 })
    setAdding(false)
  }

  return (
    <div className='stack'>
      <p className='routine-note'>
        Prueba visual — por ahora no se guarda nada al cerrar. Toca una rutina
        y marca las series al hacerlas.
      </p>
      <div className='routine-chips' role='group' aria-label='Rutinas guardadas'>
        {templates.map((template) => (
          <button
            key={template.id}
            type='button'
            className={`routine-chip${template.id === activeId ? ' is-active' : ''}`}
            aria-pressed={template.id === activeId}
            onClick={() => apply(template.id)}
          >
            {template.name}
          </button>
        ))}
      </div>
      {day.length === 0 ? (
        <p className='routine-note'>
          Toca una rutina para cargar el entrenamiento de hoy.
        </p>
      ) : (
        <>
          <ul className='routine-list'>
            {day.map((exercise) => {
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
                    <button
                      type='button'
                      className='btn-link'
                      onClick={() =>
                        setEditingId(editing ? null : exercise.id)
                      }
                    >
                      {editing ? 'Listo' : 'Editar'}
                    </button>
                  </div>
                  <div
                    className='routine-sets'
                    role='group'
                    aria-label={`Series de ${exercise.name}`}
                  >
                    {exercise.done.map((flag, index) => (
                      <button
                        key={index}
                        type='button'
                        className={`set-pill${flag ? ' is-done' : ''}`}
                        aria-pressed={flag}
                        aria-label={`Serie ${index + 1}${flag ? ' hecha' : ''}`}
                        disabled={exercise.skipped}
                        onClick={() => toggleSet(exercise.id, index)}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                  {editing && (
                    <>
                      <ExerciseFields
                        exercise={exercise}
                        onChange={(changes) => patch(exercise.id, changes)}
                      />
                      <button
                        type='button'
                        className='btn-link'
                        onClick={() =>
                          patch(exercise.id, { skipped: !exercise.skipped })
                        }
                      >
                        {exercise.skipped ? 'Volver a incluir' : 'Omitir hoy'}
                      </button>
                    </>
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
          {active && (
            <label className='routine-save'>
              <input
                type='checkbox'
                checked={saveToTemplate}
                onChange={(event) => setSaveToTemplate(event.target.checked)}
              />
              Guardar los cambios en «{active.name}»
            </label>
          )}
        </>
      )}
    </div>
  )
}
