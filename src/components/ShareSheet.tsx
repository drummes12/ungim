import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { computeMonthScore } from '../lib/scoring'
import {
  canSharePng,
  downloadPng,
  sharePng,
  svgToPngFile
} from '../lib/shareImage'
import type { Dashboard } from '../lib/types'
import { ChevronIcon } from './icons'
import { SHARE_CAPTIONS, SharePoster } from './ShareCard'
import type { ShareCardKind, ShareFormat } from './ShareCard'
import { Sheet } from './Sheet'

const cards: Array<{ id: ShareCardKind; title: string }> = [
  { id: 'today', title: 'Hoy' },
  { id: 'streak', title: 'Rachas' },
  { id: 'race', title: 'Carrera' }
]

export function ShareSheet({
  dashboard,
  today,
  initialKind,
  onClose
}: {
  dashboard: Dashboard
  today: string
  initialKind: ShareCardKind
  onClose: () => void
}) {
  const [kind, setKind] = useState(initialKind)
  const [format, setFormat] = useState<ShareFormat>('story')
  const [captionIndex, setCaptionIndex] = useState(0)
  const [preparedCard, setPreparedCard] = useState<{
    file: File
    dashboard: Dashboard
    today: string
    kind: ShareCardKind
    format: ShareFormat
    caption: string
    canShare: boolean
  } | null>(null)
  const [feedback, setFeedback] = useState('')
  const [preparationError, setPreparationError] = useState('')
  const [renderAttempt, setRenderAttempt] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const posterRef = useRef<SVGSVGElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const transitionRef = useRef(false)
  const dragRef = useRef<{
    startX: number
    startY: number
    startTime: number
    active: boolean
  } | null>(null)
  const score = useMemo(
    () => computeMonthScore(dashboard, today.slice(0, 7), today),
    [dashboard, today]
  )
  const kindIndex = cards.findIndex((card) => card.id === kind)
  const captions = SHARE_CAPTIONS[kind]
  const caption = captions[captionIndex % captions.length]
  const prepared =
    preparedCard?.dashboard === dashboard &&
    preparedCard.today === today &&
    preparedCard.kind === kind &&
    preparedCard.format === format &&
    preparedCard.caption === caption
      ? preparedCard
      : null

  useEffect(() => {
    const poster = posterRef.current
    if (!poster) return
    let cancelled = false
    let frame = 0
    setPreparedCard(null)
    setFeedback('')
    setPreparationError('')
    frame = window.requestAnimationFrame(() => {
      void svgToPngFile(
        poster,
        `ahhh-un-gim-${kind}-${format}-${today}.png`
      ).then(
        (file) => {
          if (cancelled) return
          setPreparedCard({
            file,
            dashboard,
            today,
            kind,
            format,
            caption,
            canShare: canSharePng(file)
          })
        },
        () => {
          if (cancelled) return
          setPreparationError('No pudimos preparar la imagen. Prueba otra vez.')
        }
      )
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [caption, dashboard, format, kind, renderAttempt, today])

  function invalidatePrepared() {
    setPreparedCard(null)
  }

  function animateTo(nextKind: ShareCardKind, direction: -1 | 1) {
    const poster = posterRef.current
    const preview = previewRef.current
    if (!poster || !preview || transitionRef.current || nextKind === kind)
      return
    invalidatePrepared()
    transitionRef.current = true
    setIsTransitioning(true)
    const width = preview.clientWidth
    poster.style.transition = 'transform 220ms var(--ease-out)'
    poster.style.transform = `translate3d(${direction * width}px, 0, 0)`
    window.setTimeout(() => {
      setKind(nextKind)
      setCaptionIndex(0)
      window.requestAnimationFrame(() => {
        const nextPoster = posterRef.current
        if (!nextPoster) {
          transitionRef.current = false
          setIsTransitioning(false)
          return
        }
        nextPoster.style.transition = 'none'
        nextPoster.style.transform = `translate3d(${direction * -width}px, 0, 0)`
        void nextPoster.getBoundingClientRect()
        window.requestAnimationFrame(() => {
          const incomingPoster = posterRef.current
          if (!incomingPoster) {
            transitionRef.current = false
            return
          }
          incomingPoster.style.transition = 'transform 220ms var(--ease-out)'
          incomingPoster.style.transform = 'translate3d(0, 0, 0)'
          window.setTimeout(() => {
            incomingPoster.style.transition = ''
            transitionRef.current = false
            setIsTransitioning(false)
          }, 220)
        })
      })
    }, 220)
  }

  function selectCard(nextKind: ShareCardKind) {
    const nextIndex = cards.findIndex((card) => card.id === nextKind)
    if (nextIndex === kindIndex) return
    const forward = (nextIndex - kindIndex + cards.length) % cards.length
    animateTo(nextKind, forward === 1 ? -1 : 1)
  }

  function cycleCaption(step: number) {
    invalidatePrepared()
    setCaptionIndex(
      (index) => (index + step + captions.length) % captions.length
    )
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || transitionRef.current) return
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startTime: event.timeStamp,
      active: false
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const poster = posterRef.current
    if (!drag || !poster) return
    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    if (
      !drag.active &&
      Math.abs(deltaX) > 8 &&
      Math.abs(deltaX) > Math.abs(deltaY)
    ) {
      drag.active = true
      poster.style.transition = 'none'
    }
    if (drag.active) poster.style.transform = `translate3d(${deltaX}px, 0, 0)`
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag?.active) return
    const poster = posterRef.current
    const preview = previewRef.current
    if (!poster || !preview) return
    const delta = event.clientX - drag.startX
    const velocity = delta / Math.max(1, event.timeStamp - drag.startTime)
    const threshold = Math.max(32, preview.clientWidth * 0.2)
    if (
      Math.abs(delta) > threshold ||
      (Math.abs(velocity) > 0.45 && Math.abs(delta) > 12)
    ) {
      const direction = delta < 0 ? -1 : 1
      const nextIndex =
        (kindIndex + (direction < 0 ? 1 : cards.length - 1)) % cards.length
      animateTo(cards[nextIndex].id, direction)
      return
    }
    poster.style.transition = 'transform 180ms var(--ease-out)'
    poster.style.transform = 'translate3d(0, 0, 0)'
  }

  function onPointerCancel() {
    dragRef.current = null
    const poster = posterRef.current
    if (!poster) return
    poster.style.transition = 'transform 180ms var(--ease-out)'
    poster.style.transform = 'translate3d(0, 0, 0)'
  }

  function share() {
    if (!prepared) return
    const file = prepared.file
    const sharing = sharePng(file)
    if (!sharing) {
      downloadPng(file)
      setFeedback('Imagen guardada. Ya puedes añadirla a tu historia.')
      return
    }
    void sharing.then(
      (result) => {
        if (result === 'shared') setFeedback('Imagen lista para compartir.')
      },
      () => {
        downloadPng(file)
        setFeedback('No se abrió el menú de compartir; guardamos la imagen.')
      }
    )
  }

  function primaryAction() {
    if (preparationError) {
      setRenderAttempt((attempt) => attempt + 1)
      return
    }
    share()
  }

  return (
    <Sheet title='Comparte tu proceso' onClose={onClose}>
      <div className='share-sheet-content'>
        <div
          className='share-variants'
          role='group'
          aria-label='Elige una tarjeta'
        >
          {cards.map((card) => (
            <button
              key={card.id}
              className={`chip share-variant${kind === card.id ? ' is-active' : ''}`}
              type='button'
              disabled={isTransitioning}
              aria-pressed={kind === card.id}
              onClick={() => selectCard(card.id)}
            >
              {card.title}
            </button>
          ))}
        </div>
        <div
          className='share-formats'
          role='group'
          aria-label='Formato de imagen'
        >
          <button
            className={`chip${format === 'story' ? ' is-active' : ''}`}
            type='button'
            disabled={isTransitioning}
            aria-pressed={format === 'story'}
            onClick={() => {
              if (format === 'story') return
              invalidatePrepared()
              setFormat('story')
            }}
          >
            Story 9:16
          </button>
          <button
            className={`chip${format === 'sticker' ? ' is-active' : ''}`}
            type='button'
            disabled={isTransitioning}
            aria-pressed={format === 'sticker'}
            onClick={() => {
              if (format === 'sticker') return
              invalidatePrepared()
              setFormat('sticker')
            }}
          >
            Sticker · PNG
          </button>
          {format === 'sticker' && (
            <span className='share-alpha-note'>Fondo transparente</span>
          )}
        </div>
        <div
          ref={previewRef}
          className={`share-preview${format === 'sticker' ? ' is-sticker' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <SharePoster
            ref={posterRef}
            dashboard={dashboard}
            today={today}
            score={score}
            kind={kind}
            format={format}
            caption={caption}
          />
        </div>
        <div className='share-nav'>
          <button
            className='btn share-arrow'
            type='button'
            disabled={isTransitioning}
            aria-label='Frase anterior'
            onClick={() => cycleCaption(-1)}
          >
            <ChevronIcon />
          </button>
          <span className='num share-nav-pos' aria-live='polite'>
            {captionIndex + 1}/{captions.length} · Frase
          </span>
          <button
            className='btn share-arrow share-arrow-next'
            type='button'
            disabled={isTransitioning}
            aria-label='Siguiente frase'
            onClick={() => cycleCaption(1)}
          >
            <ChevronIcon />
          </button>
        </div>
        {(preparationError || feedback) && (
          <p
            className={`share-feedback${preparationError ? ' is-error' : ''}`}
            role='status'
          >
            {preparationError || feedback}
          </p>
        )}
        <div className='sheet-actions'>
          <button
            className='btn btn-primary'
            type='button'
            disabled={!prepared && !preparationError}
            onClick={primaryAction}
          >
            {preparationError
              ? 'Reintentar'
              : !prepared
                ? 'Preparando imagen…'
                : prepared?.canShare
                  ? 'Compartir imagen'
                  : 'Guardar imagen'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
