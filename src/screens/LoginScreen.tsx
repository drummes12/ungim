import { useState, type FormEvent } from 'react'
import { demoModeEnabled } from '../lib/api'
import { DonutIcon } from '../components/icons'

export function LoginScreen({
  onSignIn,
  configurationError
}: {
  onSignIn: (email: string, password: string) => Promise<void>
  configurationError: string | null
}) {
  const [email, setEmail] = useState(demoModeEnabled ? 'ana@ungim.test' : '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await onSignIn(email, password)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'No se pudo iniciar sesión.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className='login-screen'>
      <section className='login-card'>
        <DonutIcon className='login-donut' />
        <h1>Ahhh, un gim!</h1>
        <p className='section-label'>Competencia privada</p>
        <p>Ejercicio, comidas y rosquillas. Solo para dos.</p>

        {configurationError ? (
          <p className='form-error' role='alert'>
            {configurationError}
          </p>
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
            {demoModeEnabled && (
              <p className='field-note'>
                Demo local: ana@ungim.test o leo@ungim.test · donuts
              </p>
            )}
            {error && (
              <p className='form-error' role='alert'>
                {error}
              </p>
            )}
            <button className='primary-action' type='submit' disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}
