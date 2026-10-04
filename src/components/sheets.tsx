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
    body: 'El relleno del día sube con las comidas cumplidas, el punto marca entrenamiento y el punto rosa marca libres. Un día glaseado es un día perfecto.'
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
