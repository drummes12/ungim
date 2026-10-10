import type { CSSProperties } from 'react'
import {
  addDays,
  formatDay,
  isoWeekStart,
  monthEnd,
  monthStart,
  weekdayLetters
} from '../lib/dates'
import { dayStatus, type ScorePoint } from '../lib/scoring'
import type { Dashboard, ParticipantScore } from '../lib/types'
import { Avatar } from './Avatar'
import { DonutIcon, TrophyIcon } from './icons'

function toneStyle(color: string, extra: CSSProperties = {}): CSSProperties {
  return { ['--tone' as string]: color, ...extra }
}

function describeDay(
  date: string,
  status: ReturnType<typeof dayStatus>
): string {
  if (status.future) return `${formatDay(date)}: pendiente`
  const meals = status.planned
    ? `${status.met} de ${status.planned} comidas`
    : 'sin comidas'
  const free = status.free
    ? `, ${status.free} libre${status.free === 1 ? '' : 's'}`
    : ''
  const extra = status.extra ? ', actividad extra' : ''
  return `${formatDay(date)}: ${meals}${status.workout ? ', entrenó' : ''}${free}${extra}`
}

export function DuelBar({
  participants,
  winnerIds
}: {
  participants: ParticipantScore[]
  winnerIds: string[]
}) {
  const domain = 110
  const pct = (value: number) => `${(Math.max(0, value) / domain) * 100}%`
  return (
    <div className='duel'>
      {participants.map((participant) => {
        const exercise =
          participant.noData || !participant.workout.target
            ? 0
            : (50 * participant.workout.earned) / participant.workout.target
        const meals =
          participant.noData || !participant.meals.planned
            ? 0
            : (50 * participant.meals.met) / participant.meals.planned
        const leading =
          !participant.noData && winnerIds.includes(participant.profileId)
        return (
          <div className='duel-row' key={participant.profileId}>
            <div className='duel-head'>
              <Avatar
                name={participant.name}
                color={participant.color}
                size='sm'
              />
              <span className='duel-name'>{participant.name}</span>
              {leading && (
                <span className='lead-tag'>
                  <TrophyIcon filled />
                  {winnerIds.length === 1 ? 'Líder' : 'Empate'}
                </span>
              )}
              <strong className='num duel-total' key={participant.total}>
                {participant.noData ? '—' : participant.total.toFixed(1)}
              </strong>
            </div>
            <div
              className='duel-track'
              role='img'
              aria-label={`${participant.name}: ejercicio ${exercise.toFixed(1)}, comidas ${meals.toFixed(1)}, rosquillas ${participant.bonus}`}
            >
              <div className='duel-fill' style={toneStyle(participant.color)}>
                <span className='seg seg-ex' style={{ width: pct(exercise) }} />
                <span className='seg seg-meal' style={{ width: pct(meals) }} />
                <span
                  className='seg seg-bonus'
                  style={{ width: pct(participant.bonus) }}
                />
              </div>
              <span className='duel-mark' style={{ left: pct(100) }} />
            </div>
            <div className='duel-meta'>
              <span className='chip'>Racha {participant.streak}</span>
              {(participant.freeMeals.quota > 0 ||
                participant.freeMeals.used > 0) && (
                <span className='chip'>
                  Libres {participant.freeMeals.used}
                  {participant.freeMeals.quota > 0
                    ? `/${participant.freeMeals.quota}`
                    : ''}
                </span>
              )}
              {participant.extraPoints > 0 && (
                <span className='chip'>Extra +{participant.extraPoints}</span>
              )}
              <span
                className='donut-row'
                role='img'
                aria-label={`${participant.bonus / 2} semanas perfectas`}
              >
                {Array.from({ length: participant.bonus / 2 }).map((_, i) => (
                  <DonutIcon key={i} />
                ))}
              </span>
            </div>
          </div>
        )
      })}
      <ul className='legend'>
        <li>
          <i className='key key-ex' /> Ejercicio
        </li>
        <li>
          <i className='key key-meal' /> Comidas
        </li>
        <li>
          <i className='key key-bonus' /> Rosquillas
        </li>
      </ul>
    </div>
  )
}

export function TrendChart({
  series,
  participants,
  monthKey
}: {
  series: ScorePoint[]
  participants: ParticipantScore[]
  monthKey: string
}) {
  const width = 360
  const height = 200
  const pad = { top: 14, right: 36, bottom: 24, left: 30 }
  const days = Number(monthEnd(monthKey).slice(8, 10))
  const values = series.flatMap((point) =>
    Object.values(point.totals).filter(
      (value): value is number => value !== null
    )
  )
  const top = Math.max(20, Math.ceil(Math.max(0, ...values) / 10) * 10)
  const x = (date: string) =>
    pad.left +
    ((Number(date.slice(8, 10)) - 1) / Math.max(1, days - 1)) *
      (width - pad.left - pad.right)
  const y = (value: number) =>
    pad.top + (1 - value / top) * (height - pad.top - pad.bottom)
  const ticks = [0, top / 2, top]

  if (series.length < 2) {
    return (
      <p className='chart-empty'>
        La línea de la carrera aparece cuando haya dos días de competencia.
      </p>
    )
  }

  const summary = participants
    .map((participant) => {
      const last = [...series]
        .reverse()
        .find((point) => point.totals[participant.profileId] != null)
      return `${participant.name} ${(last?.totals[participant.profileId] ?? 0).toFixed(1)}`
    })
    .join(', ')

  return (
    <svg
      className='trend'
      viewBox={`0 0 ${width} ${height}`}
      role='img'
      aria-label={`Evolución del marcador en el mes. Actual: ${summary}`}
    >
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            className='trend-grid'
            x1={pad.left}
            x2={width - pad.right}
            y1={y(tick)}
            y2={y(tick)}
          />
          <text
            className='trend-axis'
            x={pad.left - 6}
            y={y(tick) + 4}
            textAnchor='end'
          >
            {Math.round(tick)}
          </text>
        </g>
      ))}
      {[1, 8, 15, 22, days].map((day) => (
        <text
          className='trend-axis'
          key={day}
          x={x(`${monthKey}-${String(day).padStart(2, '0')}`)}
          y={height - 6}
          textAnchor='middle'
        >
          {day}
        </text>
      ))}
      {participants.map((participant) => {
        const points = series
          .map((point) => ({
            date: point.date,
            value: point.totals[participant.profileId]
          }))
          .filter(
            (point): point is { date: string; value: number } =>
              point.value !== null
          )
        if (!points.length) return null
        const last = points[points.length - 1]
        return (
          <g key={participant.profileId}>
            <polyline
              className='trend-line'
              pathLength={1}
              stroke={participant.color}
              points={points
                .map((point) => `${x(point.date)},${y(point.value)}`)
                .join(' ')}
            />
            <circle
              className='trend-dot'
              cx={x(last.date)}
              cy={y(last.value)}
              r={5}
              fill={participant.color}
            />
            <text
              className='trend-label'
              x={x(last.date) + 9}
              y={y(last.value) + 4}
            >
              {participant.name.slice(0, 1)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function DayCell({
  dashboard,
  profileId,
  date,
  today,
  color,
  index,
  tall = false,
  onSelect,
  activeFrom
}: {
  dashboard: Dashboard
  profileId: string
  date: string
  today: string
  color: string
  index: number
  tall?: boolean
  onSelect?: (date: string) => void
  // Personal horizon: the owner's own days stay openable even before this
  // Cumbre started (they exist but never scored here).
  activeFrom?: string | null
}) {
  const raw = dayStatus(dashboard, profileId, date, today)
  const status =
    !raw.active && activeFrom && date >= activeFrom && date <= today
      ? { ...raw, active: true }
      : raw
  const fill = status.planned ? status.met / status.planned : 0
  const complete =
    status.active &&
    !status.future &&
    status.planned > 0 &&
    status.met === status.planned &&
    status.workout
  const className = [
    'cell',
    tall ? 'cell-tall' : '',
    status.future ? 'is-future' : '',
    !status.active && !status.future ? 'is-idle' : '',
    complete ? 'is-complete' : '',
    date === today ? 'is-today' : ''
  ]
    .filter(Boolean)
    .join(' ')
  const style = toneStyle(color, {
    ['--fill' as string]: String(fill),
    ['--delay' as string]: `${Math.min(index, 30) * 14}ms`
  })
  const content = (
    <>
      {complete ? (
        <svg
          className='cell-glaze'
          viewBox='0 0 40 40'
          preserveAspectRatio='xMidYMid slice'
          aria-hidden='true'
        >
          <rect width='40' height='40' fill='#e8a961' />
          <path
            d='M0 15c5-4 9 2 14-2 4-3 8 1 13-2 4-2.5 9 1 13-1v30H0Z'
            fill='#ffb3c9'
          />
          <g strokeLinecap='round' strokeWidth='3'>
            <path d='m11 22 3.4 1.7' stroke='#fffdf9' />
            <path d='m18 28 3.2-1.8' stroke='#ffe08f' />
            <path d='m27 21 1.9 3.4' stroke='#fffdf9' />
            <path d='m31 30 3-1.7' stroke='#ffe08f' />
            <path d='m14 35 3.3-2' stroke='#fffdf9' />
            <path d='m24 35 2.4 3' stroke='#ffe08f' />
          </g>
          <path
            d='M0 15c5-4 9 2 14-2 4-3 8 1 13-2 4-2.5 9 1 13-1'
            fill='none'
            stroke='rgba(20,17,15,0.18)'
            strokeWidth='1.4'
          />
        </svg>
      ) : (
        <span className='cell-fill' />
      )}
      <span className='cell-day num'>{Number(date.slice(8, 10))}</span>
      {status.workout && !complete && <span className='cell-dot' />}
      {status.free > 0 && <span className='cell-free' />}
      {status.extra > 0 && <span className='cell-extra' />}
    </>
  )
  const label = describeDay(date, status)
  if (!onSelect || status.future || !status.active) {
    return (
      <div className={className} style={style} role='img' aria-label={label}>
        {content}
      </div>
    )
  }
  return (
    <button
      type='button'
      className={className}
      style={style}
      aria-label={label}
      onClick={() => onSelect(date)}
    >
      {content}
    </button>
  )
}

export function ChartLegend() {
  return (
    <ul className='legend'>
      <li>
        <i className='key key-cell' /> Comidas cumplidas
      </li>
      <li>
        <i className='key key-dot' /> Entrenamiento
      </li>
      <li>
        <i className='key key-free' /> Comida libre
      </li>
      <li>
        <i className='key key-extra' /> Actividad extra
      </li>
      <li>
        <i className='key key-future' /> Pendiente
      </li>
    </ul>
  )
}

export function MonthGrid({
  dashboard,
  profileId,
  monthKey,
  today,
  color,
  onSelect,
  activeFrom
}: {
  dashboard: Dashboard
  profileId: string
  monthKey: string
  today: string
  color: string
  onSelect?: (date: string) => void
  activeFrom?: string | null
}) {
  const first = monthStart(monthKey)
  const last = monthEnd(monthKey)
  const offset = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7
  const dates: string[] = []
  for (let date = first; date <= last; date = addDays(date, 1)) dates.push(date)
  return (
    <div className='month-grid'>
      {weekdayLetters.map((letter) => (
        <span className='grid-head' key={letter} aria-hidden='true'>
          {letter}
        </span>
      ))}
      {Array.from({ length: offset }).map((_, index) => (
        <span key={`blank-${index}`} />
      ))}
      {dates.map((date, index) => (
        <DayCell
          key={date}
          dashboard={dashboard}
          profileId={profileId}
          date={date}
          today={today}
          color={color}
          index={index}
          onSelect={onSelect}
          activeFrom={activeFrom}
        />
      ))}
    </div>
  )
}

export function WeekStrip({
  dashboard,
  profileId,
  today,
  color,
  onSelect
}: {
  dashboard: Dashboard
  profileId: string
  today: string
  color: string
  onSelect?: (date: string) => void
}) {
  const start = isoWeekStart(today)
  return (
    <div className='week-strip'>
      {weekdayLetters.map((letter, index) => {
        const date = addDays(start, index)
        return (
          <div className='week-col' key={date}>
            <span className='grid-head' aria-hidden='true'>
              {letter}
            </span>
            <DayCell
              dashboard={dashboard}
              profileId={profileId}
              date={date}
              today={today}
              color={color}
              index={index}
              tall
              onSelect={onSelect}
            />
          </div>
        )
      })}
    </div>
  )
}
