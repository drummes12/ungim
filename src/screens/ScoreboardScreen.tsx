import { useRef, useState } from 'react'
import {
  addDays,
  formatMonth,
  isoWeekStart,
  monthKeyForDate,
  previousMonthKey
} from '../lib/dates'
import {
  computeMonthScore,
  isPerfectWeek,
  scoreSeries
} from '../lib/scoring'
import { shareOrDownloadPng } from '../lib/shareImage'
import type { Dashboard } from '../lib/types'
import { DuelBar, TrendChart } from '../components/charts'
import { Sheet } from '../components/Sheet'
import {
  RACE_CAPTIONS,
  ShareCard,
  WEEK_CAPTIONS,
  WeekShareCard,
  raceMood
} from '../components/ShareCard'
import { ChevronIcon, ShareIcon } from '../components/icons'

export function ScoreboardScreen({
  dashboard,
  today,
  online,
  pendingCount,
  onRequestClose
}: {
  dashboard: Dashboard
  today: string
  online: boolean
  pendingCount: number
  onRequestClose: (monthKey: string) => void
}) {
  const currentMonth = monthKeyForDate(today)
  const score = computeMonthScore(dashboard, currentMonth, today)
  const series = scoreSeries(dashboard, currentMonth, today)
  const [shareOpen, setShareOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [variant, setVariant] = useState<'race' | 'week'>('race')
  const [captionIndex, setCaptionIndex] = useState(0)
  const shareCardRef = useRef<HTMLDivElement>(null)
  const swipeStart = useRef<number | null>(null)
  const mood = raceMood(
    dashboard.currentProfileId,
    score.participants,
    score.winnerIds
  )
  const weekStart = isoWeekStart(today)
  const weekPerfect =
    isPerfectWeek(
      dashboard,
      dashboard.currentProfileId,
      weekStart,
      dashboard.settings?.startsOn ?? ''
    ) && addDays(weekStart, 6) <= today
  const captions =
    variant === 'race'
      ? RACE_CAPTIONS[mood]
      : WEEK_CAPTIONS[weekPerfect ? 'perfect' : 'progress']
  const caption = captions[captionIndex % captions.length]

  function cycleCaption(step: number) {
    setCaptionIndex(
      (index) => (index + step + captions.length) % captions.length
    )
  }

  function selectVariant(next: 'race' | 'week') {
    setVariant(next)
    setCaptionIndex(0)
  }

  function onSwipeStart(clientX: number) {
    swipeStart.current = clientX
  }

  function onSwipeEnd(clientX: number) {
    if (swipeStart.current === null) return
    const delta = clientX - swipeStart.current
    swipeStart.current = null
    if (Math.abs(delta) > 40) cycleCaption(delta < 0 ? 1 : -1)
  }

  async function onShare() {
    const el = shareCardRef.current
    if (!el || sharing) return
    setSharing(true)
    try {
      const result = await shareOrDownloadPng(el, `ungim-${currentMonth}.png`)
      console.log('[share]', result)
    } catch (err) {
      console.warn('[share] falló', err)
    } finally {
      setSharing(false)
    }
  }
  const closableMonths: string[] = []
  if (dashboard.settings?.startsOn) {
    for (
      let month = previousMonthKey(currentMonth);
      month >= monthKeyForDate(dashboard.settings.startsOn);
      month = previousMonthKey(month)
    ) {
      if (!dashboard.months[month]?.closedAt) closableMonths.unshift(month)
    }
  }

  return (
    <main className='screen scoreboard-screen'>
      <header className='page-head'>
        <div>
          <h1>Marcador</h1>
          <p className='page-sub'>
            {formatMonth(currentMonth)}. Base 50/50 + rosquillas por semanas
            perfectas.
          </p>
        </div>
      </header>

      {closableMonths.map((monthKey) => {
        const confirmed = dashboard.months[monthKey]?.confirmedBy ?? []
        const mine = confirmed.includes(dashboard.currentProfileId)
        return (
          <section className='close-banner' key={monthKey}>
            <div>
              <strong>{formatMonth(monthKey)} ya terminó</strong>
              <p>
                {confirmed.length
                  ? `Confirmado por ${confirmed.length} de ${dashboard.profiles.length}.`
                  : 'Ambos deben confirmar el resultado.'}
              </p>
              {(!online || pendingCount > 0) && (
                <small>
                  Sincroniza los registros pendientes antes de cerrar.
                </small>
              )}
            </div>
            <button
              className='btn btn-primary'
              type='button'
              disabled={mine}
              onClick={() => onRequestClose(monthKey)}
            >
              {mine ? 'Confirmado' : 'Confirmar cierre'}
            </button>
          </section>
        )
      })}

      <div className='split-main'>
        <section className='block' aria-label='Carrera'>
          <h2 className='block-title'>
            La carrera
            <button
              className='btn btn-icon share-btn'
              type='button'
              aria-label='Compartir marcador'
              onClick={() => setShareOpen(true)}
            >
              <ShareIcon />
            </button>
          </h2>
          <DuelBar
            participants={score.participants}
            winnerIds={score.winnerIds}
          />
        </section>

        <section className='block' aria-label='Evolución'>
          <h2 className='block-title'>Día a día</h2>
          <TrendChart
            series={series}
            participants={score.participants}
            monthKey={currentMonth}
          />
        </section>

        <section className='block' aria-label='Detalle base'>
          <h2 className='block-title'>Detalle base</h2>
          <ul className='rule-list'>
            {score.participants.map((participant) => (
              <li key={participant.profileId}>
                <span>{participant.name}</span>
                <strong className='num'>
                  {participant.workout.earned}/{participant.workout.target}{' '}
                  ejercicio · {participant.meals.met}/
                  {participant.meals.planned} comidas
                </strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {shareOpen && (
        <Sheet title='Compartir' onClose={() => setShareOpen(false)}>
          <div className='sheet-body'>
            <div className='share-variants' role='tablist' aria-label='Card'>
              <button
                className={`chip share-variant${variant === 'race' ? ' is-active' : ''}`}
                type='button'
                role='tab'
                aria-selected={variant === 'race'}
                onClick={() => selectVariant('race')}
              >
                La carrera
              </button>
              <button
                className={`chip share-variant${variant === 'week' ? ' is-active' : ''}`}
                type='button'
                role='tab'
                aria-selected={variant === 'week'}
                onClick={() => selectVariant('week')}
              >
                Semana
              </button>
            </div>
            <div
              className='share-preview'
              onPointerDown={(e) => onSwipeStart(e.clientX)}
              onPointerUp={(e) => onSwipeEnd(e.clientX)}
            >
              {variant === 'race' ? (
                <ShareCard
                  ref={shareCardRef}
                  participants={score.participants}
                  winnerIds={score.winnerIds}
                  monthLabel={formatMonth(currentMonth)}
                  day={Number(today.slice(8, 10))}
                  daysInMonth={new Date(
                    Number(currentMonth.slice(0, 4)),
                    Number(currentMonth.slice(5, 7)),
                    0
                  ).getDate()}
                  caption={caption}
                />
              ) : (
                <WeekShareCard
                  ref={shareCardRef}
                  dashboard={dashboard}
                  today={today}
                  caption={caption}
                />
              )}
            </div>
            <div className='share-nav'>
              <button
                className='btn share-arrow'
                type='button'
                aria-label='Frase anterior'
                onClick={() => cycleCaption(-1)}
              >
                <ChevronIcon />
              </button>
              <span className='num share-nav-pos'>
                {(captionIndex % captions.length) + 1}/{captions.length}
              </span>
              <button
                className='btn share-arrow share-arrow-next'
                type='button'
                aria-label='Siguiente frase'
                onClick={() => cycleCaption(1)}
              >
                <ChevronIcon />
              </button>
            </div>
            <div className='sheet-actions'>
              <button
                className='btn btn-primary'
                type='button'
                disabled={sharing}
                onClick={onShare}
              >
                {sharing ? 'Generando…' : 'Compartir'}
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </main>
  )
}
