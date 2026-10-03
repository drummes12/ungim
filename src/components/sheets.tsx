import { useState, type FormEvent } from 'react'
import { formatMonth, monthEnd } from '../lib/dates'
import { computeMonthScore } from '../lib/scoring'
import type { Dashboard, Profile, WorkoutEntry } from '../lib/types'
import { Avatar } from './Avatar'
import { DuelBar } from './charts'

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

export function AccountPanel({
  profile,
  partner,
  onEditPlan,
  onInstall,
  onSignOut
}: {
  profile: Profile | undefined
  partner: Profile | undefined
  onEditPlan: () => void
  onInstall: () => void
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
      <button className='btn btn-block' type='button' onClick={onInstall}>
        Instalar la app
      </button>
      <button className='btn btn-block' type='button' onClick={onSignOut}>
        Salir
      </button>
    </div>
  )
}
