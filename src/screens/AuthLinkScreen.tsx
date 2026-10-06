import { useEffect, useRef, useState, type FormEvent } from 'react'
import { BrandIcon } from '../components/icons'
import { PasswordInput } from '../components/fields'
import type { AuthLinkInput } from '../lib/types'
import { GlazeEdge, SprinkleField } from './LoginScreen'

const PASSWORD_TYPES = new Set(['invite', 'recovery'])

export function AuthLinkScreen({
  tokenHash,
  type,
  onComplete,
  onCancel
}: {
  tokenHash: string
  type: string
  onComplete: (input: AuthLinkInput) => Promise<void>
  onCancel: () => void
}) {
  const needsPassword = PASSWORD_TYPES.has(type)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const verified = useRef(false)

  useEffect(() => {
    if (needsPassword || verified.current) return
    verified.current = true
    setLoading(true)
    onComplete({ tokenHash, type }).catch((cause) => {
      setError(
        cause instanceof Error
          ? cause.message
          : 'El enlace no funcionó. Pide uno nuevo.'
      )
      setLoading(false)
    })
  }, [needsPassword, onComplete, tokenHash, type])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await onComplete({ tokenHash, type, password })
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'El enlace no funcionó. Pide uno nuevo.'
      )
      setLoading(false)
    }
  }

  const copy =
    type === 'invite'
      ? {
          title: 'Crea tu contraseña',
          note: 'Bienvenida al gim. Elige la contraseña de tu cuenta y entra a competir.'
        }
      : type === 'recovery'
        ? {
            title: 'Nueva contraseña',
            note: 'Elige una contraseña nueva para volver a entrenar.'
          }
        : { title: 'Verificando tu enlace…', note: 'Un momento.' }

  return (
    <main className='login-screen'>
      <section className='login-brand'>
        <a className='login-logo-link' href='/' aria-label='Ir al inicio'>
          <BrandIcon className='login-donut' />
        </a>
        <SprinkleField />
        <h1>Ahhh, un gim!</h1>
        <p className='page-sub'>
          Ejercicio, comidas y rosquillas. Una competencia privada para dos.
        </p>
        <GlazeEdge />
      </section>
      <section className='login-card'>
        <h2>{copy.title}</h2>
        {needsPassword && !error && <p className='field-note'>{copy.note}</p>}
        {needsPassword && !error && (
          <form onSubmit={submit}>
            <label>
              Contraseña nueva
              <PasswordInput
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete='new-password'
                minLength={6}
                required
              />
            </label>
            <label>
              Repite la contraseña
              <PasswordInput
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete='new-password'
                minLength={6}
                required
              />
            </label>
            <button
              className='btn btn-primary'
              type='submit'
              disabled={loading}
            >
              {loading ? 'Guardando…' : 'Guardar y entrar'}
            </button>
          </form>
        )}
        {!needsPassword && !error && (
          <p className='field-note'>
            <span className='loader' aria-hidden='true' /> {copy.note}
          </p>
        )}
        {error && (
          <>
            <p className='form-error' role='alert'>
              {error}
            </p>
            <button className='btn-link' type='button' onClick={onCancel}>
              Volver al login
            </button>
          </>
        )}
      </section>
    </main>
  )
}
