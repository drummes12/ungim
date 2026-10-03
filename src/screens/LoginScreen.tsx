import { useState, type FormEvent } from 'react'
import { demoModeEnabled } from '../lib/api'
import { BrandIcon } from '../components/icons'

const GLAZE_H =
  'M0 14 C14 4 22 30 36 26 C50 22 44 40 58 36 C72 32 66 14 80 18 C94 22 88 36 102 32 C116 28 112 10 126 14 C140 18 134 34 148 30 C162 26 156 8 170 12 C184 16 178 32 192 28 C206 24 200 40 214 36 C228 32 222 14 236 18 C250 22 244 36 258 32 C272 28 268 12 282 16 C296 20 290 34 304 30 C318 26 312 10 326 14 C340 18 346 28 360 24'

const GLAZE_V =
  'M14 0 C4 14 30 22 26 36 C22 50 40 44 36 58 C32 72 14 66 18 80 C22 94 36 88 32 102 C28 116 10 112 14 126 C18 140 34 134 30 148 C26 162 8 156 12 170 C16 184 32 178 28 192 C24 206 40 200 36 214 C32 228 14 222 18 236 C22 250 36 244 32 258 C28 272 12 268 16 282 C20 296 34 290 30 304 C26 318 10 312 14 326 C18 340 28 346 24 360'

export function GlazeEdge() {
  return (
    <>
      <svg
        className='login-glaze login-glaze-h'
        viewBox='0 0 360 42'
        preserveAspectRatio='none'
        aria-hidden='true'
      >
        <path d={`${GLAZE_H} L360 0 L0 0 Z`} fill='var(--coral)' />
        <path
          d={GLAZE_H}
          fill='none'
          stroke='var(--ink)'
          strokeWidth='2'
          strokeLinecap='round'
        />
      </svg>
      <svg
        className='login-glaze login-glaze-v'
        viewBox='0 0 42 360'
        preserveAspectRatio='none'
        aria-hidden='true'
      >
        <path d={`${GLAZE_V} L0 360 L0 0 Z`} fill='var(--coral)' />
        <path
          d={GLAZE_V}
          fill='none'
          stroke='var(--ink)'
          strokeWidth='2'
          strokeLinecap='round'
        />
      </svg>
    </>
  )
}

export function LoginScreen({
  onSignIn,
  onResetPassword,
  configurationError
}: {
  onSignIn: (email: string, password: string) => Promise<void>
  onResetPassword: (email: string) => Promise<void>
  configurationError: string | null
}) {
  const [email, setEmail] = useState(demoModeEnabled ? 'ana@ungim.test' : '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'signin' | 'reset' | 'sent'>('signin')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (mode === 'reset') {
        await onResetPassword(email)
        setMode('sent')
      } else {
        await onSignIn(email, password)
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : mode === 'reset'
            ? 'No se pudo enviar el correo.'
            : 'No se pudo iniciar sesión.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className='login-screen'>
      <section className='login-brand'>
        <BrandIcon className='login-donut' />
        <h1>Ahhh, un gim!</h1>
        <p className='page-sub'>
          Ejercicio, comidas y rosquillas. Una competencia privada para dos.
        </p>
        <GlazeEdge />
      </section>
      <section className='login-card'>
        <h2>
          {mode === 'signin' ? 'Entra a tu cuenta' : 'Recupera tu contraseña'}
        </h2>
        {configurationError ? (
          <p className='form-error' role='alert'>
            {configurationError}
          </p>
        ) : mode === 'sent' ? (
          <>
            <p className='field-note'>
              Te enviamos un enlace a {email || 'tu correo'} para crear una
              contraseña nueva. Revisa también spam.
            </p>
            <button
              className='btn-link'
              type='button'
              onClick={() => {
                setMode('signin')
                setError(null)
              }}
            >
              Volver al login
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <label>
              Correo
              <input
                type='email'
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete='email'
                inputMode='email'
                required
              />
            </label>
            {mode === 'signin' && (
              <label>
                Contraseña
                <input
                  type='password'
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete='current-password'
                  required
                />
              </label>
            )}
            {demoModeEnabled && mode === 'signin' && (
              <p className='field-note'>
                Demo local: ana@ungim.test o leo@ungim.test · donuts
              </p>
            )}
            {error && (
              <p className='form-error' role='alert'>
                {error}
              </p>
            )}
            <button
              className='btn btn-primary'
              type='submit'
              disabled={loading}
            >
              {mode === 'reset'
                ? loading
                  ? 'Enviando…'
                  : 'Enviar enlace'
                : loading
                  ? 'Entrando…'
                  : 'Entrar'}
            </button>
            {mode === 'signin' ? (
              <button
                className='btn-link'
                type='button'
                onClick={() => {
                  setMode('reset')
                  setError(null)
                }}
              >
                Olvidé mi contraseña
              </button>
            ) : (
              <button
                className='btn-link'
                type='button'
                onClick={() => {
                  setMode('signin')
                  setError(null)
                }}
              >
                Volver al login
              </button>
            )}
          </form>
        )}
      </section>
    </main>
  )
}
