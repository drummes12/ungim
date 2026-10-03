export function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10.8 12 4l8 6.8V20h-5.5v-5h-5v5H4V10.8Z" />
    </svg>
  )
}

export function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4h10v4.5A5 5 0 0 1 12 13a5 5 0 0 1-5-4.5V4Zm-3 1h3v4.8A4.8 4.8 0 0 1 4 5Zm16 0h-3v4.8A4.8 4.8 0 0 0 20 5ZM10 15h4v3h3v2H7v-2h3v-3Z" />
    </svg>
  )
}

export function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h2v3h8V3h2v3h3v15H3V6h3V3Zm13 7H5v9h14v-9Z" />
    </svg>
  )
}

export function DumbbellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9h3v6H4v-2H2v-2h2V9Zm13 0h3v2h2v2h-2v2h-3V9Zm-9 2h8v2H8v-2Zm-3-4h3v10H5V7Zm11 0h3v10h-3V7Z" />
    </svg>
  )
}

export function DonutIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="27" fill="#d99043" />
      <path
        d="M6 32c0-6.5 5-9.6 10.4-8.9 4.3.6 5.6 5.2 10.2 4.7 5-.5 4.6-6.4 10.8-6.4 5.2 0 7 4.3 10.7 4.8 4 .5 9.9-2 9.9 6A26.9 26.9 0 0 1 32 58 26.9 26.9 0 0 1 6 32Z"
        fill="#ff75a8"
      />
      <circle cx="32" cy="32" r="8" fill="#fff6ec" />
      <path d="m20 24 4 2M39 20l2 4M48 31l4 2M21 39l4-1M36 45l3-3" stroke="#fff6ec" strokeWidth="3" strokeLinecap="round" />
      <path d="m15 31 3-3M45 42l3 4" stroke="#ffd447" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
