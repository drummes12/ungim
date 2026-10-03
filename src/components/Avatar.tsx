export function Avatar({ name, color, size = 'md' }: { name: string; color: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`avatar avatar-${size}`} style={{ backgroundColor: color }} aria-hidden="true">
      {name.trim().slice(0, 1).toUpperCase()}
    </span>
  )
}
