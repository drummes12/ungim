import { useId } from 'react'

const base = {
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
} as const

interface IconProps {
  filled?: boolean
}

export function HomeIcon({ filled = false }: IconProps) {
  return (
    <svg
      {...base}
      fill={filled ? 'currentColor' : 'none'}
      stroke='currentColor'
    >
      <path d='M3.6 11 12 3.8l8.4 7.2v8.6a.9.9 0 0 1-.9.9H15v-5.6H9v5.6H4.5a.9.9 0 0 1-.9-.9V11Z' />
    </svg>
  )
}

export function TrophyIcon({ filled = false }: IconProps) {
  return (
    <svg {...base} fill='none' stroke='currentColor'>
      <path
        d='M8 4h8v5.2a4 4 0 0 1-8 0V4Z'
        fill={filled ? 'currentColor' : 'none'}
      />
      <path d='M8 5.5H4.6v1.7A3.1 3.1 0 0 0 8 10.3M16 5.5h3.4v1.7a3.1 3.1 0 0 1-3.4 3.1M12 13.2V17M8.6 20h6.8M9.6 17h4.8' />
    </svg>
  )
}

export function CalendarIcon({ filled = false }: IconProps) {
  return (
    <svg {...base} fill='none' stroke='currentColor'>
      <rect
        x='3.6'
        y='5'
        width='16.8'
        height='15.4'
        rx='2.6'
        fill={filled ? 'currentColor' : 'none'}
      />
      <path d='M8 3v4M16 3v4' />
      {!filled && <path d='M3.6 10h16.8' />}
    </svg>
  )
}

export function DumbbellIcon() {
  return (
    <svg viewBox='0 0 64 64' aria-hidden='true'>
      <rect x='6' y='27.8' width='4' height='12.4' rx='2' fill='#14110f' />
      <rect x='11.5' y='24' width='4' height='20' rx='2' fill='#14110f' />
      <rect x='17' y='20.2' width='4' height='27.6' rx='2' fill='#14110f' />
      <rect x='18' y='32' width='27' height='4' rx='2' fill='#14110f' />
      <rect x='43' y='20.2' width='4' height='27.6' rx='2' fill='#14110f' />
      <rect x='48.5' y='24' width='4' height='20' rx='2' fill='#14110f' />
      <rect x='54' y='27.8' width='4' height='12.4' rx='2' fill='#14110f' />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg {...base} fill='none' stroke='currentColor' strokeWidth={2.2}>
      <path d='m6 6 12 12M18 6 6 18' />
    </svg>
  )
}

export function CheckIcon() {
  return (
    <svg {...base} fill='none' stroke='currentColor' strokeWidth={2.6}>
      <path d='m5 12.5 4.5 4.5L19 7.5' />
    </svg>
  )
}

export function ChevronIcon() {
  return (
    <svg {...base} fill='none' stroke='currentColor' strokeWidth={2.2}>
      <path d='m9 5 7 7-7 7' />
    </svg>
  )
}

export function BrandIcon({ className = '' }: { className?: string }) {
  const maskId = useId().replace(/:/g, '')

  return (
    <svg
      className={className}
      viewBox='0 0 64 64'
      width='64'
      height='64'
      aria-hidden='true'
      preserveAspectRatio='xMidYMid meet'
    >
      <defs>
        <mask id={maskId}>
          <rect width='64' height='64' fill='#ffffff' />
          <circle cx='32' cy='33.5' r='6.5' fill='#000000' />
        </mask>
      </defs>

      {/* Líneas laterales */}
      <rect x='6' y='27.8' width='4' height='12.4' rx='2' fill='#14110f' />
      <rect x='11.5' y='24' width='4' height='20' rx='2' fill='#14110f' />
      <rect x='48.5' y='24' width='4' height='20' rx='2' fill='#14110f' />
      <rect x='54' y='27.8' width='4' height='12.4' rx='2' fill='#14110f' />

      {/* Dona */}
      <g
        transform='translate(32 34) scale(0.66) translate(-32 -34)'
        mask={`url(#${maskId})`}
      >
        <circle cx='32' cy='34' r='21' fill='#e8a961' />

        <path
          d='M11 33.5c0-5 4-7.4 8.2-6.8 3.4.4 4.4 4 8 3.6 4-.3 3.6-4.9 8.5-4.9 4 0 5.5 3.3 8.4 3.7 3.1.4 7.5-1.6 7.5 4.4a20.7 20.7 0 0 1-20.3 20.7 20.7 20.7 0 0 1-20.3-20.7Z'
          fill='#ffb3c9'
        />

        <circle
          cx='32'
          cy='34'
          r='21'
          fill='none'
          stroke='#14110f'
          strokeWidth='3.4'
        />
        <circle
          cx='32'
          cy='33.5'
          r='8'
          fill='none'
          stroke='#14110f'
          strokeWidth='3.4'
        />

        <path
          d='m21 27.5 3 1.5M38 24l1.5 3.1M45 32.5l3 1.5M22 39.5l3-.8M36.5 44l2.2-2.3'
          stroke='#fffdf9'
          strokeWidth='3'
          strokeLinecap='round'
        />

        <path
          d='m17 32.5 2.2-2.3M44 42l2.3 3'
          stroke='#ffe08f'
          strokeWidth='3'
          strokeLinecap='round'
        />
      </g>
    </svg>
  )
}

export function DonutIcon({ className = '' }: { className?: string }) {
  const maskId = useId().replace(/:/g, '')
  return (
    <svg className={className} viewBox='0 0 64 64' aria-hidden='true'>
      <mask id={maskId}>
        <circle cx='32' cy='32' r='27' fill='#ffffff' />
        <circle cx='32' cy='32' r='8' fill='#000000' />
      </mask>
      <g mask={`url(#${maskId})`}>
        <circle cx='32' cy='32' r='27' fill='#e8a961' />
        <path
          d='M6 32c0-6.5 5-9.6 10.4-8.9 4.3.6 5.6 5.2 10.2 4.7 5-.5 4.6-6.4 10.8-6.4 5.2 0 7 4.3 10.7 4.8 4 .5 9.9-2 9.9 6A26.9 26.9 0 0 1 32 58 26.9 26.9 0 0 1 6 32Z'
          fill='#ffb3c9'
        />
      </g>
      <circle
        cx='32'
        cy='32'
        r='27'
        fill='none'
        stroke='#14110f'
        strokeWidth='3'
      />
      <circle
        cx='32'
        cy='32'
        r='8'
        fill='none'
        stroke='#14110f'
        strokeWidth='3'
      />
      <path
        d='m20 24 4 2M39 20l2 4M48 31l4 2M21 39l4-1M36 45l3-3'
        stroke='#fffdf8'
        strokeWidth='3'
        strokeLinecap='round'
      />
      <path
        d='m15 31 3-3M45 42l3 4'
        stroke='#ffe08f'
        strokeWidth='3'
        strokeLinecap='round'
      />
    </svg>
  )
}
