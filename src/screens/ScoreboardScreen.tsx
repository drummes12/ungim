import { formatMonth, monthKeyForDate, previousMonthKey } from '../lib/dates'
import { computeMonthScore, scoreSeries } from '../lib/scoring'
import type { Dashboard } from '../lib/types'
import { DuelBar, TrendChart } from '../components/charts'
import { ShareIcon } from '../components/icons'

export function ScoreboardScreen({
  dashboard,
  today,
  online,
  pendingCount,
  onRequestClose,
  onShare
}: {
  dashboard: Dashboard
  today: string
  online: boolean
  pendingCount: number
  onRequestClose: (monthKey: string) => void
  onShare: () => void
}) {
  const currentMonth = monthKeyForDate(today)
  const score = computeMonthScore(dashboard, currentMonth, today)
  const series = scoreSeries(dashboard, currentMonth, today)
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
              onClick={onShare}
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
    </main>
  )
}
