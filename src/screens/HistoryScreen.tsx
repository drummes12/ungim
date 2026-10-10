import { useMemo, useState } from 'react'
import { formatMonth, monthKeyForDate, previousMonthKey } from '../lib/dates'
import { computeMonthScore } from '../lib/scoring'
import type { Dashboard } from '../lib/types'
import { Avatar } from '../components/Avatar'
import { ChartLegend, MonthGrid } from '../components/charts'

export function HistoryScreen({
  dashboard,
  competitionId,
  today,
  onOpenDay
}: {
  dashboard: Dashboard
  competitionId: string
  today: string
  onOpenDay: (date: string) => void
}) {
  const currentMonth = monthKeyForDate(today)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const compMonths = dashboard.months[competitionId] ?? {}
  const competitionStart = dashboard.settings?.startsOn ?? null

  const months = useMemo(() => {
    if (!competitionStart) return [currentMonth]
    const result: string[] = []
    for (
      let month = currentMonth;
      month >= monthKeyForDate(competitionStart);
      month = previousMonthKey(month)
    ) {
      result.push(month)
    }
    return result
  }, [competitionStart, currentMonth])

  const selectedRecord = compMonths[selectedMonth]
  const score =
    selectedRecord?.result ?? computeMonthScore(dashboard, selectedMonth, today)
  const closed = Boolean(selectedRecord?.closedAt)
  const winnerNames = score.winnerIds
    .map((id) => dashboard.profiles.find((p) => p.id === id)?.displayName)
    .filter(Boolean)
  const verdict = closed
    ? winnerNames.length !== 1
      ? 'Empate.'
      : `Ganó ${winnerNames[0] ?? 'nadie'}.`
    : winnerNames.length === 1
      ? `Va ganando ${winnerNames[0]}.`
      : 'Empatados por ahora.'
  const me = dashboard.profiles.find(
    (profile) => profile.id === dashboard.currentProfileId
  )
  const others = dashboard.profiles.filter(
    (profile) => profile.id !== dashboard.currentProfileId
  )

  return (
    <main className='screen history-screen'>
      <header className='page-head'>
        <div>
          <h1>Historial</h1>
          <p className='page-sub'>
            Toca un día para corregirlo mientras el mes siga abierto.
          </p>
        </div>
      </header>

      <div className='month-tabs' role='tablist' aria-label='Meses'>
        {months.map((month) => {
          const record = compMonths[month]
          const monthScore =
            record?.result ?? computeMonthScore(dashboard, month, today)
          const winners = monthScore.winnerIds
            .map((id) =>
              dashboard.profiles.find((profile) => profile.id === id)
            )
            .filter(Boolean)
          return (
            <button
              className={`month-tab ${selectedMonth === month ? 'is-selected' : ''}`}
              type='button'
              role='tab'
              aria-selected={selectedMonth === month}
              key={month}
              onClick={() => setSelectedMonth(month)}
            >
              <span>{formatMonth(month)}</span>
              <strong>
                {record?.closedAt
                  ? winners.length !== 1
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

      <div className='split split-even'>
        <div className='split-main'>
          <section className='block' aria-label='Resumen del mes'>
            <h2 className='block-title'>{formatMonth(selectedMonth)}</h2>
            <ul className='rule-list'>
              {score.participants.map((participant) => (
                <li key={participant.profileId}>
                  <span>{participant.name}</span>
                  <strong className='num'>
                    {participant.noData ? '—' : participant.total.toFixed(1)}
                  </strong>
                </li>
              ))}
            </ul>
            <p className='field-note'>
              {verdict}{' '}
              {closed
                ? 'Mes cerrado e inmutable.'
                : 'Este mes sigue abierto a correcciones.'}
            </p>
          </section>
        </div>

        <div className='split-side'>
          {me && (
            <section className='block' aria-label='Tu mes'>
              <h2 className='block-title with-avatar'>
                <Avatar
                  name={me.displayName}
                  color={me.avatarColor}
                  size='sm'
                />
                {me.displayName}
              </h2>
              <MonthGrid
                dashboard={dashboard}
                profileId={me.id}
                monthKey={selectedMonth}
                today={today}
                color={me.avatarColor}
                onSelect={onOpenDay}
              />
            </section>
          )}
          {others.map((profile) => (
            <section
              className='block'
              key={profile.id}
              aria-label={`Mes de ${profile.displayName}`}
            >
              <h2 className='block-title with-avatar'>
                <Avatar
                  name={profile.displayName}
                  color={profile.avatarColor}
                  size='sm'
                />
                {profile.displayName}
              </h2>
              <MonthGrid
                dashboard={dashboard}
                profileId={profile.id}
                monthKey={selectedMonth}
                today={today}
                color={profile.avatarColor}
              />
            </section>
          ))}
          <ChartLegend />
        </div>
      </div>
    </main>
  )
}
