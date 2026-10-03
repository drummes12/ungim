import { DonutIcon } from './icons'

export function StatusPill({
  online,
  pending,
  error
}: {
  online: boolean
  pending: number
  error: string | null
}) {
  const label = error
    ? 'Sincronización detenida'
    : pending
      ? `${pending} por sincronizar`
      : !online
        ? 'Sin conexión'
        : 'Al día'
  return (
    <span
      className={`status-pill ${error || !online || pending ? 'status-warn' : 'status-ok'}`}
    >
      <DonutIcon className='status-donut' />
      {label}
    </span>
  )
}
