import { useState, type InputHTMLAttributes } from 'react'
import { EyeIcon } from './icons'

export function NumField({
  label,
  value,
  step = 1,
  min,
  max,
  format = String,
  decLabel,
  incLabel,
  disabled = false,
  onChange
}: {
  label?: string
  value: number
  step?: number
  min: number
  max: number
  format?: (value: number) => string
  decLabel?: string
  incLabel?: string
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <div className='num-field'>
      {label ? <span>{label}</span> : null}
      <div className='stepper stepper-capsule'>
        <button
          type='button'
          aria-label={decLabel ?? `Menos ${label ?? 'valor'}`}
          disabled={disabled || value - step < min}
          onClick={() => onChange(value - step)}
        >
          −
        </button>
        <strong>{format(value)}</strong>
        <button
          type='button'
          aria-label={incLabel ?? `Más ${label ?? 'valor'}`}
          disabled={disabled || value + step > max}
          onClick={() => onChange(value + step)}
        >
          +
        </button>
      </div>
    </div>
  )
}

export function PasswordInput(
  props: InputHTMLAttributes<HTMLInputElement>
) {
  const [visible, setVisible] = useState(false)
  return (
    <span className='pass-wrap'>
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type='button'
        className='pass-toggle'
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        <EyeIcon off={visible} />
      </button>
    </span>
  )
}
