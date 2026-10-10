import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode
} from 'react'
import { CloseIcon } from './icons'

const closeDelay = 260
const phoneQuery = '(max-width: 959px)'

export function Sheet({
  title,
  onClose,
  children,
  wide = false
}: {
  title: string
  onClose: () => void
  children: ReactNode | ((close: () => void) => ReactNode)
  wide?: boolean
}) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const drag = useRef<{
    startY: number
    samples: Array<{ t: number; y: number }>
  } | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [])

  useEffect(() => {
    if (!closing) return
    const timer = window.setTimeout(() => onCloseRef.current(), closeDelay)
    return () => window.clearTimeout(timer)
  }, [closing])

  const requestClose = useCallback(() => setClosing(true), [])

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      !window.matchMedia(phoneQuery).matches ||
      (event.target as HTMLElement).closest('button')
    )
      return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      startY: event.clientY,
      samples: [{ t: event.timeStamp, y: event.clientY }]
    }
    if (panelRef.current) panelRef.current.style.transition = 'none'
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current
    if (!state || !panelRef.current) return
    const raw = event.clientY - state.startY
    const offset = Math.max(0, raw)
    panelRef.current.style.transform = `translateY(${offset}px)`
    state.samples.push({ t: event.timeStamp, y: event.clientY })
    if (state.samples.length > 6) state.samples.shift()
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current
    const panel = panelRef.current
    drag.current = null
    if (!state || !panel) return
    const first = state.samples[0]
    const elapsed = Math.max(1, event.timeStamp - first.t)
    const velocity = (event.clientY - first.y) / elapsed
    const distance = event.clientY - state.startY
    panel.style.transition = ''
    panel.style.transform = ''
    if (
      distance > panel.offsetHeight * 0.33 ||
      (velocity > 0.6 && distance > 12)
    )
      requestClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className={`sheet${wide ? ' sheet-wide' : ''}`}
      data-state={closing ? 'closing' : 'open'}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        const open = document.querySelectorAll('dialog[open]')
        if (open[open.length - 1] === dialogRef.current) requestClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <div className='sheet-panel' ref={panelRef}>
        <div
          className='sheet-head'
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className='sheet-grab' aria-hidden='true' />
          <h2 id={titleId}>{title}</h2>
          <button
            className='sheet-close'
            type='button'
            aria-label='Cerrar'
            onClick={requestClose}
          >
            <CloseIcon />
          </button>
        </div>
        <div className='sheet-body'>
          {typeof children === 'function' ? children(requestClose) : children}
        </div>
      </div>
    </dialog>
  )
}
