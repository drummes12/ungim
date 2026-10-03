import { formatMonth, monthKeyForDate, previousMonthKey } from '../lib/dates'
import { computeMonthScore } from '../lib/scoring'
import type { Dashboard } from '../lib/types'
import { Avatar } from '../components/Avatar'
import { DonutIcon, TrophyIcon } from '../components/icons'

export function ScoreboardScreen({
  dashboard,
  today,
  online,
  pendingCount,
  onConfirmMonth
}: {
  dashboard: Dashboard
  today: string
  online: boolean
  pendingCount: number
  onConfirmMonth: (monthKey: string) => void
}) {
  const currentMonth = monthKeyForDate(today)
  const score = computeMonthScore(dashboard, currentMonth, today)
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
  const leaders = score.winnerIds
  const competitionStarted = Boolean(dashboard.settings?.startsOn)

  return (
    <main className='screen scoreboard-screen'>
      <header className='section-heading'>
        <h1>Marcador</h1>
        <p className='section-label'>{formatMonth(currentMonth)}</p>
        <p>Base 50/50 + rosquillas por semanas perfectas.</p>
      </header>

      <section className='versus-card'>
        {score.participants.map((participant) => {
          const winning =
            leaders.includes(participant.profileId) && !participant.noData
          return (
            <article
              className={`participant-score ${winning ? 'is-winning' : ''}`}
              key={participant.profileId}
            >
              <Avatar name={participant.name} color={participant.color} />
              <div className='participant-name'>
                <span>{participant.name}</span>
                {winning && (
                  <small>
                    <TrophyIcon /> {leaders.length === 1 ? 'Líder' : 'Empate'}
                  </small>
                )}
              </div>
              <strong>
                {participant.noData ? '—' : participant.total.toFixed(1)}
              </strong>
              <div className='score-breakdown'>
                <span>
                  Base {participant.noData ? '—' : participant.base.toFixed(1)}
                </span>
                <span>Bonus +{participant.bonus}</span>
                <span>Racha {participant.streak}</span>
              </div>
              <div
                className='donut-row'
                aria-label={`${participant.bonus / 2} semanas perfectas`}
              >
                {Array.from({ length: participant.bonus / 2 }).map(
                  (_, index) => (
                    <DonutIcon key={index} />
                  )
                )}
                {participant.bonus === 0 && <span>Sin bonus todavía</span>}
              </div>
            </article>
          )
        })}
      </section>

      <section className='detail-card'>
        <h2 className='card-title'>Detalle base</h2>
        {score.participants.map((participant) => (
          <div className='metric-row' key={participant.profileId}>
            <span>{participant.name}</span>
            <strong>
              {participant.workout.earned}/{participant.workout.target}{' '}
              ejercicio · {participant.meals.met}/{participant.meals.planned}{' '}
              comidas
            </strong>
          </div>
        ))}
      </section>

      {competitionStarted &&
        closableMonths.map((monthToClose) => (
          <section className='close-card' key={monthToClose}>
            <div>
              <h2>{formatMonth(monthToClose)} ya terminó</h2>
              <p className='section-label'>Cierre mensual</p>
              <p>
                {dashboard.months[monthToClose]?.confirmedBy?.length
                  ? `Confirmado por ${dashboard.months[monthToClose].confirmedBy.length} de ${dashboard.profiles.length}.`
                  : 'Ambos deben confirmar el resultado.'}
              </p>
            </div>
            <button
              className='primary-action'
              type='button'
              disabled={
                !online ||
                pendingCount > 0 ||
                dashboard.months[monthToClose]?.confirmedBy.includes(
                  dashboard.currentProfileId
                )
              }
              onClick={() => onConfirmMonth(monthToClose)}
            >
              {dashboard.months[monthToClose]?.confirmedBy.includes(
                dashboard.currentProfileId
              )
                ? 'Confirmado'
                : 'Confirmar cierre'}
            </button>
            {(!online || pendingCount > 0) && (
              <small>
                Sincroniza los registros pendientes antes de cerrar.
              </small>
            )}
          </section>
        ))}
    </main>
  )
}
