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
      {filled ? (
        <path
          d='M3.6 9.3V7.6a2.6 2.6 0 0 1 2.6-2.6h11.6a2.6 2.6 0 0 1 2.6 2.6v1.7ZM3.6 11.2h16.8v6.6a2.6 2.6 0 0 1-2.6 2.6H6.2a2.6 2.6 0 0 1-2.6-2.6Z'
          fill='currentColor'
          stroke='none'
        />
      ) : (
        <rect x='3.6' y='5' width='16.8' height='15.4' rx='2.6' />
      )}
      <path d='M8 3v4M16 3v4' />
      {!filled && <path d='M3.6 10h16.8' />}
    </svg>
  )
}

export function DumbbellIcon() {
  return (
    <svg viewBox='0 0 64 64' aria-hidden='true'>
      <rect x='6' y='25.8' width='4' height='12.4' rx='2' fill='#14110f' />
      <rect x='11.5' y='22' width='4' height='20' rx='2' fill='#14110f' />
      <rect x='17' y='18.2' width='4' height='27.6' rx='2' fill='#14110f' />
      <rect x='18' y='30' width='27' height='4' rx='2' fill='#14110f' />
      <rect x='43' y='18.2' width='4' height='27.6' rx='2' fill='#14110f' />
      <rect x='48.5' y='22' width='4' height='20' rx='2' fill='#14110f' />
      <rect x='54' y='25.8' width='4' height='12.4' rx='2' fill='#14110f' />
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

export function TrashIcon() {
  return (
    <svg {...base} fill='none' stroke='currentColor' strokeWidth={2.2}>
      <path d='M4 7h16M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M6.5 7l.8 12a1 1 0 0 0 1 1h7.4a1 1 0 0 0 1-1l.8-12' />
      <path d='M10 11v5.5M14 11v5.5' />
    </svg>
  )
}

export function CloudCheckIcon() {
  return (
    <svg
      {...base}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={2}
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M0 0h24v24H0z' stroke='none' />
      <path d='M11 18.004H6.657C4.085 18 2 15.993 2 13.517s2.085-4.482 4.657-4.482c.393-1.762 1.794-3.2 3.675-3.773 1.88-.572 3.956-.193 5.444 1 1.488 1.19 2.162 3.007 1.77 4.769h.99c1.388 0 2.585.82 3.138 2.007M15 19l2 2 4-4' />
    </svg>
  )
}

export function CloudOffIcon() {
  return (
    <svg
      {...base}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={2}
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M0 0h24v24H0z' stroke='none' />
      <path d='M13 18.004H6.657C4.085 18 2 15.993 2 13.517s2.085-4.482 4.657-4.482c.393-1.762 1.794-3.2 3.675-3.773 1.88-.572 3.956-.193 5.444 1 1.488 1.19 2.162 3.007 1.77 4.769h.99c1.37 0 2.556.8 3.117 1.964M22 22l-5-5M17 22l5-5' />
    </svg>
  )
}

export function ExtraIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 64 64' aria-hidden='true'>
      <line x1='36' y1='3' x2='36' y2='13' stroke='#14110f' strokeWidth='3' />
      <path
        d='M36 3 L49 6.5 L36 10 Z'
        fill='#ff9078'
        stroke='#14110f'
        strokeWidth='1.75'
        strokeLinejoin='round'
      />
      <path
        d='M18 56 L36 12 L55 56 Z'
        fill='#abe7c2'
        stroke='#14110f'
        strokeWidth='3.5'
        strokeLinejoin='round'
      />
      <path
        d='M36 12 L39.6 21.5 L43.6 29.5 L38.8 27 L36.4 31.5 L32.9 23.5 Z'
        fill='#fffdf9'
        stroke='#14110f'
        strokeWidth='1.75'
        strokeLinejoin='round'
      />
      <path
        d='M4 56 L22.8 25.8 L41.5 56 Z'
        fill='#ffb3c9'
        stroke='#14110f'
        strokeWidth='3.5'
        strokeLinejoin='round'
      />
      <path
        d='M22.8 25.8 L26.8 33.3 L30.6 39.3 L26.1 36.8 L22.8 41 L19.3 35 Z'
        fill='#fffdf9'
        stroke='#14110f'
        strokeWidth='1.75'
        strokeLinejoin='round'
      />
      <path
        d='M8.5 47 L12.5 44.5 M51.5 45.5 L55.5 48'
        stroke='#14110f'
        strokeWidth='2.5'
        strokeLinecap='round'
      />
      <path
        d='M4 56 H60'
        stroke='#14110f'
        strokeWidth='4'
        strokeLinecap='round'
      />
    </svg>
  )
}

export function HelpIcon() {
  return (
    <svg {...base} fill='none' stroke='currentColor' strokeWidth={2}>
      <circle cx='12' cy='12' r='9' />
      <circle cx='12' cy='12' r='3.6' />
      <path d='m5.6 5.6 3.9 3.9' />
      <path d='m14.5 14.5 3.9 3.9' />
      <path d='m18.4 5.6-3.9 3.9' />
      <path d='m9.5 14.5-3.9 3.9' />
    </svg>
  )
}

export function SyncIcon() {
  return (
    <svg {...base} fill='none' stroke='currentColor' strokeWidth={2}>
      <path d='M19 9.5A7.6 7.6 0 0 0 6 7.2M5 14.5A7.6 7.6 0 0 0 18 16.8' />
      <path d='M19 4.5v5h-5M5 19.5v-5h5' />
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

export function TreatIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 64 64' aria-hidden='true'>
      <circle
        cx='32'
        cy='23'
        r='14'
        fill='#ffb3c9'
        stroke='#14110f'
        strokeWidth='3'
      />
      <circle cx='32' cy='8' r='3.6' fill='#f05a43' stroke='#14110f' strokeWidth='2.4' />
      <path
        d='M21 34h22L32 57Z'
        fill='#e8a961'
        stroke='#14110f'
        strokeWidth='3'
        strokeLinejoin='round'
      />
      <path
        d='m25 18 3.4 1.7M36 14.5l1.8 3.4M40 24.5l3 1.6M23 27.5l3-1'
        stroke='#fffdf9'
        strokeWidth='2.6'
        strokeLinecap='round'
      />
      <path d='m27.5 45 3.4 3M34 40l2.6 3.4' stroke='#fffdf9' strokeWidth='2.4' strokeLinecap='round' />
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
        d='m17.9 23.6 3.8 2M39.7 19.1l1.9 4M48.7 30.1l3.9 1.9M19.1 39.1l3.9-1M37.8 44.9l2.8-3'
        stroke='#fffdf8'
        strokeWidth='3'
        strokeLinecap='round'
      />
      <path
        d='m12.7 30.1 2.9-3M47.4 42.3l3 3.8'
        stroke='#ffe08f'
        strokeWidth='3'
        strokeLinecap='round'
      />
    </svg>
  )
}
