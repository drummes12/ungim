import { useMemo, useState } from 'react'
import {
  addDays,
  formatDay,
  formatMonth,
  listDates,
  maxDate,
  minDate,
  monthEnd,
  monthKeyForDate,
  monthStart
} from '../lib/dates'
import { computeMonthScore } from '../lib/scoring'
import type { Dashboard, MealSlot, MealStatus } from '../lib/types'
import { Avatar } from '../components/Avatar'
import { DayEditor } from '../components/DayEditor'

export function HistoryScreen({
  dashboard,
  today,
  onMeal,
  onWorkout,
  onWorkoutDetails
}: {
  dashboard: Dashboard
  today: string
  onMeal: (date: string, slot: MealSlot, status: MealStatus | null) => void
  onWorkout: (date: string, done: boolean) => void
  onWorkoutDetails: (date: string, workoutType: string, note: string) => void
}) {
  const currentMonth = monthKeyForDate(today)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [selectedDate, setSelectedDate] = useState(today)
  const competitionStart = dashboard.settings?.startsOn ?? null

  const months = useMemo(() => {
    if (!competitionStart) return [currentMonth]
    const result: string[] = []
    for (
      let month = currentMonth;
      month >= monthKeyForDate(competitionStart);
      month = previousMonth(month)
    ) {
      result.push(month)
    }
    return result
  }, [competitionStart, currentMonth])

  const selectedRecord = dashboard.months[selectedMonth]
  const score =
    selectedRecord?.result ?? computeMonthScore(dashboard, selectedMonth, today)
  const firstDate = maxDate(
    monthStart(selectedMonth),
    competitionStart ?? monthStart(selectedMonth)
  )
  const lastDate = minDate(monthEnd(selectedMonth), today)
  const dates = listDates(firstDate, lastDate).reverse()
  const closed = Boolean(selectedRecord?.closedAt)

  function previousMonth(month: string) {
    const date = monthStart(month)
    return addDays(date, -1).slice(0, 7)
  }

  return (
    <main className='screen history-screen'>
      <header className='section-heading'>
        <h1>Historial</h1>
        <p>Meses abiertos se pueden corregir hasta el cierre.</p>
      </header>

      <div className='month-list' aria-label='Meses'>
        {months.map((month) => {
          const record = dashboard.months[month]
          const monthScore =
            record?.result ?? computeMonthScore(dashboard, month, today)
          const winners = monthScore.winnerIds
            .map((id) =>
              dashboard.profiles.find((profile) => profile.id === id)
            )
            .filter(Boolean)
          return (
            <button
              className={`month-item ${selectedMonth === month ? 'is-selected' : ''}`}
              type='button'
              key={month}
              onClick={() => {
                setSelectedMonth(month)
                setSelectedDate(minDate(monthEnd(month), today))
              }}
            >
              <span>{formatMonth(month)}</span>
              <strong>
                {record?.closedAt
                  ? winners.length === 2
                    ? 'Empate'
                    : winners[0]?.displayName || 'Sin ganador'
                  : month === currentMonth
                    ? 'En juego'
                    : 'Pendiente'}
              </strong>
            </button>
          )
        })}
      </div>

      <section className='month-summary-card'>
        <h2 className='card-title'>{formatMonth(selectedMonth)}</h2>
        <div className='summary-participants'>
          {score.participants.map((participant) => (
            <div key={participant.profileId}>
              <Avatar
                name={participant.name}
                color={participant.color}
                size='sm'
              />
              <span>{participant.name}</span>
              <strong>
                {participant.noData ? '—' : participant.total.toFixed(1)}
              </strong>
            </div>
          ))}
        </div>
        <p>
          {closed
            ? 'Mes cerrado e inmutable.'
            : 'Este mes sigue abierto a correcciones.'}
        </p>
      </section>

      <section className='calendar-list'>
        <h2 className='card-title'>Días</h2>
        {dates.map((date) => {
          const selected = date === selectedDate
          const editable =
            !closed &&
            date <= today &&
            (!competitionStart || date >= competitionStart)
          return (
            <article
              className={`calendar-day ${selected ? 'is-selected' : ''}`}
              key={date}
            >
              <button type='button' onClick={() => setSelectedDate(date)}>
                <span>{formatDay(date)}</span>
                <strong>
                  {editable ? 'Editable' : closed ? 'Cerrado' : 'Solo lectura'}
                </strong>
              </button>
              {selected && (
                <DayEditor
                  key={date}
                  dashboard={dashboard}
                  profileId={dashboard.currentProfileId}
                  date={date}
                  editable={editable}
                  onMeal={onMeal}
                  onWorkout={onWorkout}
                  onWorkoutDetails={onWorkoutDetails}
                />
              )}
            </article>
          )
        })}
        {dates.length === 0 && (
          <p className='empty-copy'>No hay días elegibles en este mes.</p>
        )}
      </section>
    </main>
  )
}
