import { CloudCheckIcon, CloudOffIcon, SyncIcon } from './icons'

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
      role='status'
      aria-label={label}
      title={label}
    >
      {error ? (
        <CloudOffIcon />
      ) : pending ? (
        <span className='status-spin'>
          <SyncIcon />
        </span>
      ) : !online ? (
        <CloudOffIcon />
      ) : (
        <CloudCheckIcon />
      )}
    </span>
  )
}
