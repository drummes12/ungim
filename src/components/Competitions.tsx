import { useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'react-qr-code'
import type { Competition, Dashboard } from '../lib/types'
import { Avatar } from './Avatar'
import { Sheet } from './Sheet'
import {
  ChevronIcon,
  CopyIcon,
  DonutIcon,
  MountainIcon,
  RefreshIcon,
  UsersIcon
} from './icons'

export function inviteLink(code: string): string {
  return `${window.location.origin}/app?join=${encodeURIComponent(code)}`
}

const CURATED_TIMEZONES = [
  'America/Bogota',
  'America/Mexico_City',
  'America/Lima',
  'America/Guayaquil',
  'America/Panama',
  'America/Costa_Rica',
  'America/Caracas',
  'America/Santiago',
  'America/Buenos_Aires',
  'America/Sao_Paulo',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/Madrid',
  'Europe/London',
  'Europe/Paris',
  'UTC'
]

export function CompetitionSwitcher({
  competitions,
  activeId,
  onSelect
}: {
  competitions: Competition[]
  activeId: string | null
  onSelect: (id: string) => void
}) {
  if (!competitions.length) return null
  return (
    <div className='comp-switcher'>
      <label className='comp-select'>
        <MountainIcon className='comp-select-icon' />
        <select
          aria-label='Cumbre activa'
          value={activeId ?? ''}
          onChange={(event) => onSelect(event.target.value)}
        >
          {competitions.map((competition) => (
            <option key={competition.id} value={competition.id}>
              {competition.name}
            </option>
          ))}
        </select>
        <ChevronIcon />
      </label>
    </div>
  )
}

function QrWithLogo({ value }: { value: string }) {
  return (
    <div className='invite-qr'>
      <QRCode
        value={value}
        size={148}
        bgColor='transparent'
        fgColor='#14110f'
      />
      <span className='invite-qr-logo' aria-hidden='true'>
        <DonutIcon />
      </span>
    </div>
  )
}

function CompetitionDetail({
  competition,
  dashboard,
  onLeave,
  onRegenerate,
  onInvite,
  onClose
}: {
  competition: Competition
  dashboard: Dashboard
  onLeave: (competitionId: string) => Promise<void>
  onRegenerate: (competitionId: string) => Promise<void>
  onInvite: (
    competitionId: string,
    email: string
  ) => Promise<'sent' | 'existing_user'>
  onClose: () => void
}) {
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')

  async function copy(value: string, what: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(what)
    } catch {
      setNotice(`Barrita: ${value}`)
    } finally {
      window.setTimeout(() => setCopied(null), 1600)
    }
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Algo falló.')
    } finally {
      setBusy(false)
    }
  }

  if (confirmLeave) {
    return (
      <div className='stack cumbre-confirm'>
        <MountainIcon className='cumbre-title-icon' />
        <p>
          <strong>¿Sales de {competition.name}?</strong>
          <br />
          Tus registros se quedan contigo; la Cumbre sigue sin ti.
        </p>
        {error && (
          <p className='form-error' role='alert'>
            {error}
          </p>
        )}
        <div className='sheet-actions'>
          <button
            className='btn'
            type='button'
            onClick={() => setConfirmLeave(false)}
          >
            Quedarme
          </button>
          <button
            className='btn btn-danger'
            type='button'
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await onLeave(competition.id)
                onClose()
              })
            }
          >
            Salir de la Cumbre
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className='stack'>
      <ul className='cumbre-members'>
        {competition.members.map((member) => {
          const profile = dashboard.profiles.find(
            (item) => item.id === member.profileId
          )
          return (
            <li key={member.profileId}>
              <Avatar
                name={profile?.displayName ?? '?'}
                color={profile?.avatarColor ?? '#14110f'}
                size='sm'
              />
              <span>
                {profile?.displayName ?? 'Compañero'}
                {member.profileId === dashboard.currentProfileId && ' (tú)'}
              </span>
              {member.status === 'paused' && (
                <span className='chip'>en pausa</span>
              )}
            </li>
          )
        })}
        <li className='cumbre-count'>
          <UsersIcon /> {competition.members.length} de 5 compañeros de
          expedición
        </li>
      </ul>

      <div className='invite-box'>
        <QrWithLogo value={inviteLink(competition.inviteCode)} />
        <div className='invite-code'>
          <span className='field-note'>La barrita (código de invitación)</span>
          <strong className='num'>{competition.inviteCode}</strong>
          <div className='invite-actions'>
            <button
              className='btn btn-primary'
              type='button'
              onClick={() => void copy(competition.inviteCode, 'code')}
            >
              <CopyIcon /> {copied === 'code' ? 'Copiado' : 'Código'}
            </button>
            <button
              className='btn btn-quiet'
              type='button'
              onClick={() =>
                void copy(inviteLink(competition.inviteCode), 'link')
              }
            >
              <CopyIcon /> {copied === 'link' ? 'Copiado' : 'Link'}
            </button>
            <button
              className='btn btn-quiet'
              type='button'
              disabled={busy}
              onClick={() => setConfirmRegen(true)}
            >
              <RefreshIcon /> Nueva barrita
            </button>
          </div>
          {confirmRegen ? (
            <div className='invite-regen' role='alert'>
              <span>La barrita anterior deja de servir.</span>
              <div className='invite-actions'>
                <button
                  className='btn btn-quiet'
                  type='button'
                  onClick={() => setConfirmRegen(false)}
                >
                  Cancelar
                </button>
                <button
                  className='btn btn-danger'
                  type='button'
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await onRegenerate(competition.id)
                      setConfirmRegen(false)
                      setNotice('Barrita regenerada.')
                    })
                  }
                >
                  Regenerar
                </button>
              </div>
            </div>
          ) : (
            notice && (
              <p className='field-note' role='status'>
                {notice}
              </p>
            )
          )}
          <form
            className='invite-email'
            onSubmit={(event) => {
              event.preventDefault()
              const email = inviteEmail.trim()
              if (!email) return
              void run(async () => {
                const status = await onInvite(competition.id, email)
                setNotice(
                  status === 'existing_user'
                    ? 'Esa persona ya tiene cuenta — compártale la barrita.'
                    : `Invitación enviada a ${email}.`
                )
                setInviteEmail('')
              })
            }}
          >
            <label htmlFor='invite-email'>Invitar por correo</label>
            <div className='invite-email-row'>
              <input
                id='invite-email'
                type='email'
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder='correo@ejemplo.com'
                autoComplete='off'
                inputMode='email'
                required
              />
              <button
                className='btn btn-quiet'
                type='submit'
                disabled={busy || !inviteEmail.trim()}
              >
                Invitar
              </button>
            </div>
          </form>
        </div>
      </div>

      {error && (
        <p className='form-error' role='alert'>
          {error}
        </p>
      )}
      <button
        className='btn btn-block btn-danger'
        type='button'
        onClick={() => setConfirmLeave(true)}
      >
        Salir de esta Cumbre
      </button>
    </div>
  )
}

export function CumbresPanel({
  dashboard,
  initialJoinCode,
  onCreate,
  onJoin,
  onLeave,
  onRegenerate,
  onInvite
}: {
  dashboard: Dashboard
  initialJoinCode?: string
  onCreate: (name: string, timezone: string) => Promise<void>
  onJoin: (code: string) => Promise<void>
  onLeave: (competitionId: string) => Promise<void>
  onRegenerate: (competitionId: string) => Promise<void>
  onInvite: (
    competitionId: string,
    email: string
  ) => Promise<'sent' | 'existing_user'>
}) {
  const [joinCode, setJoinCode] = useState(initialJoinCode ?? '')
  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState(
    dashboard.settings?.homeTimezone ??
      Intl.DateTimeFormat().resolvedOptions().timeZone ??
      'UTC'
  )
  const [busy, setBusy] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [joined, setJoined] = useState<string | null>(null)
  const [created, setCreated] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const detected =
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'
  const timezones = [
    ...new Set([detected, ...CURATED_TIMEZONES])
  ]
  const detail = dashboard.competitions.find((item) => item.id === detailId)
  const membershipCount = dashboard.competitions.length
  const [prevCount, setPrevCount] = useState(membershipCount)
  const [leftNotice, setLeftNotice] = useState(false)
  if (prevCount !== membershipCount) {
    setLeftNotice(membershipCount < prevCount)
    setPrevCount(membershipCount)
    setJoinError(null)
    setCreateError(null)
  }

  async function join(event: FormEvent) {
    event.preventDefault()
    if (!joinCode.trim()) return
    setBusy(true)
    setJoinError(null)
    setJoined(null)
    try {
      await onJoin(joinCode.trim())
      setJoined(joinCode.trim().toUpperCase())
      setJoinCode('')
    } catch (cause) {
      setJoinError(
        cause instanceof Error ? cause.message : 'No se pudo unir.'
      )
    } finally {
      setBusy(false)
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setCreateError(null)
    setCreated(null)
    try {
      await onCreate(name.trim(), timezone)
      setCreated(name.trim())
      setName('')
    } catch (cause) {
      setCreateError(
        cause instanceof Error ? cause.message : 'No se pudo crear.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='stack'>
      <p className='page-sub'>
        Cada Cumbre es una competencia privada: solo se ven quienes la escalan
        contigo. Hasta 5 compañeros por Cumbre y 3 Cumbres por persona.
      </p>

      {leftNotice && (
        <p className='field-note' role='status'>
          Saliste de la Cumbre.
        </p>
      )}
      {dashboard.competitions.length > 0 && (
        <ul className='cumbre-list'>
          {dashboard.competitions.map((competition) => (
            <li key={competition.id}>
              <button
                className='cumbre-row'
                type='button'
                onClick={() => setDetailId(competition.id)}
              >
                <MountainIcon className='cumbre-title-icon' />
                <span className='cumbre-row-name'>{competition.name}</span>
                <span className='cumbre-row-count'>
                  {competition.members.length}/5
                </span>
                <ChevronIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className='block cumbre-form'
        onSubmit={join}
        aria-label='Unirme a una Cumbre'
      >
        <h3 className='block-title'>Unirme a una Cumbre</h3>
        <label>
          Barrita
          <input
            value={joinCode}
            onChange={(event) =>
              setJoinCode(event.target.value.toUpperCase())
            }
            maxLength={8}
            placeholder='ROSA42'
            autoCapitalize='characters'
            autoComplete='off'
          />
        </label>
        {joinError && (
          <p className='form-error' role='alert'>
            {joinError}
          </p>
        )}
        {joined && (
          <p className='field-note' role='status'>
            Ya estás dentro — ábrela en la lista de arriba.
          </p>
        )}
        <button
          className='btn btn-primary btn-block'
          type='submit'
          disabled={busy || !joinCode.trim()}
        >
          Unirme
        </button>
      </form>

      <form
        className='block cumbre-form'
        onSubmit={create}
        aria-label='Crear una Cumbre'
      >
        <h3 className='block-title'>Crear una Cumbre</h3>
        <label>
          Nombre
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
            placeholder='Familia, Amigos del gim…'
          />
        </label>
        <label>
          Zona horaria de la Cumbre
          <select
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            required
          >
            {timezones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </label>
        {createError && (
          <p className='form-error' role='alert'>
            {createError}
          </p>
        )}
        {created && (
          <p className='field-note' role='status'>
            {created} ya existe — comparte su barrita para invitar.
          </p>
        )}
        <button
          className='btn btn-primary btn-block'
          type='submit'
          disabled={busy || !name.trim()}
        >
          Crear Cumbre
        </button>
      </form>

      {detail &&
        createPortal(
          <Sheet title={detail.name} onClose={() => setDetailId(null)}>
            <CompetitionDetail
              competition={detail}
              dashboard={dashboard}
              onLeave={onLeave}
              onRegenerate={onRegenerate}
              onInvite={onInvite}
              onClose={() => setDetailId(null)}
            />
          </Sheet>,
          document.body
        )}
    </div>
  )
}
