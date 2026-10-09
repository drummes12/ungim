import type { Ref } from 'react'
import type { Dashboard, ParticipantScore } from '../lib/types'
import { addDays, formatWeekRange, isoWeekStart, weekdayLetters } from '../lib/dates'
import { dayStatus, isPerfectWeek } from '../lib/scoring'
import { DuelBar } from './charts'
import { BrandIcon, CheckIcon, DonutIcon } from './icons'

export type RaceMood = 'leading' | 'tied' | 'chasing'

export const RACE_CAPTIONS: Record<RaceMood, string[]> = {
  leading: [
    'La delantera se cocina, no se regala.',
    'Modo imparable.',
    'Que venga a buscarme.',
    'Líder del mes. Que tiemble el cierre.'
  ],
  tied: [
    'Empatados. Esto se pone bueno.',
    'Punto a punto. Se define en la cocina.',
    'Nivel a nivel — el mes decide.'
  ],
  chasing: [
    'Voy por la delantera.',
    'Remontada en progreso.',
    'Segundo lugar. Por ahora.',
    'Que no se confíe el líder.'
  ]
}

export const WEEK_CAPTIONS = {
  perfect: [
    '7 de 7. Semana perfecta.',
    'Ni una comida libre. Toda una semana.',
    'La rosquilla es mía.',
    'Sin fallas. Así se entrena.'
  ],
  progress: [
    'Camino a la semana perfecta.',
    'Día a día, sin excusas.',
    'Que nadie mueva el marcador.'
  ]
}

export function raceMood(
  currentProfileId: string,
  participants: ParticipantScore[],
  winnerIds: string[]
): RaceMood {
  const me = participants.find((p) => p.profileId === currentProfileId)
  if (!me || me.noData || participants.filter((p) => !p.noData).length < 2)
    return 'tied'
  if (winnerIds.length !== 1) return 'tied'
  return winnerIds[0] === currentProfileId ? 'leading' : 'chasing'
}

export function ShareCard({
  participants,
  winnerIds,
  monthLabel,
  day,
  daysInMonth,
  caption,
  ref
}: {
  participants: ParticipantScore[]
  winnerIds: string[]
  monthLabel: string
  day: number
  daysInMonth: number
  caption: string
  ref?: Ref<HTMLDivElement>
}) {
  return (
    <div className='share-card' ref={ref}>
      <div className='share-head'>
        <span className='share-eyebrow'>La carrera · {monthLabel}</span>
        <BrandIcon className='share-brand' />
      </div>
      <p className='share-headline'>{caption}</p>
      <DuelBar participants={participants} winnerIds={winnerIds} />
      <div className='share-foot'>
        <span className='share-wordmark'>Ahhh, un gim!</span>
        <span className='num share-date'>
          día {day} de {daysInMonth}
        </span>
      </div>
    </div>
  )
}

export function WeekShareCard({
  dashboard,
  today,
  caption,
  ref
}: {
  dashboard: Dashboard
  today: string
  caption: string
  ref?: Ref<HTMLDivElement>
}) {
  const profile = dashboard.profiles.find(
    (p) => p.id === dashboard.currentProfileId
  )
  const weekStart = isoWeekStart(today)
  const days = weekdayLetters.map((letter, index) => {
    const date = addDays(weekStart, index)
    const status = dayStatus(dashboard, dashboard.currentProfileId, date, today)
    return { letter, date, status }
  })
  const doneCount = days.filter(
    ({ status }) => status.planned > 0 && status.met === status.planned
  ).length
  const perfect =
    isPerfectWeek(
      dashboard,
      dashboard.currentProfileId,
      weekStart,
      dashboard.settings?.startsOn ?? ''
    ) && days.every(({ status }) => !status.future)

  return (
    <div className='share-card' ref={ref}>
      <div className='share-head'>
        <span className='share-eyebrow'>
          Semana · {formatWeekRange(weekStart)}
        </span>
        <BrandIcon className='share-brand' />
      </div>
      <p className='share-headline'>{caption}</p>
      <div className='share-week-hero'>
        <DonutIcon className='share-donut' />
        <div className='share-week-name'>
          <strong>{profile?.displayName ?? ''}</strong>
          <span className='num share-week-count'>
            {perfect ? '+1 rosquilla al marcador' : `${doneCount} de 7 días`}
          </span>
        </div>
      </div>
      <div className='share-week'>
        {days.map(({ letter, date, status }) => {
          const complete =
            status.active && status.planned > 0 && status.met === status.planned
          return (
            <div className='share-day' key={date}>
              <span className='share-day-letter'>{letter}</span>
              <span
                className={`share-day-cell${complete ? ' is-done' : ''}${status.future ? ' is-future' : ''}`}
              >
                {complete && <CheckIcon />}
              </span>
              <span
                className={`share-day-dot${status.workout ? ' is-on' : ''}`}
              />
            </div>
          )
        })}
      </div>
      <div className='share-foot'>
        <span className='share-wordmark'>Ahhh, un gim!</span>
      </div>
    </div>
  )
}
