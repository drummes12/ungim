import type { ReactNode, Ref } from 'react'
import { formatDay, formatMonth } from '../lib/dates'
import {
  consecutiveMealDays,
  dayStatus,
  perfectWeekStreak,
  workoutProgressThisWeek
} from '../lib/scoring'
import type { Dashboard, MonthResult } from '../lib/types'
import { BrandIcon, DonutIcon } from './icons'

export type ShareCardKind = 'today' | 'streak' | 'race'
export type ShareFormat = 'story' | 'sticker'

export const SHARE_CAPTIONS: Record<ShareCardKind, string[]> = {
  today: ['OTRO DÍA QUE SUMA', 'MI PROCESO. MI RITMO.', 'PASO A PASO.'],
  streak: [
    'NO ES SUERTE. ES REPETIR.',
    'UNA COMIDA A LA VEZ.',
    'SEMANAS QUE DEJAN HUELLA.'
  ],
  race: [
    'UNA SEMANA A LA VEZ.',
    'CADA PUNTO CUENTA.',
    'EL PROCESO TAMBIÉN SE CELEBRA.'
  ]
}

const ink = '#14110f'
const paper = '#faf1e7'
const surface = '#fffdf9'
const coral = '#ff9078'
const blue = '#557fd8'
const yellow = '#ffe08f'
const font =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif"
const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace'

function DonutMark({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 64})`}>
      <DonutIcon />
    </g>
  )
}

function BrandLine({
  x = 76,
  y = 110,
  size = 28
}: {
  x?: number
  y?: number
  size?: number
}) {
  return (
    <g>
      <g transform={`translate(${x} ${y - size + 8}) scale(${size / 64})`}>
        <BrandIcon />
      </g>
      <text
        x={x + size + 14}
        y={y}
        fill={ink}
        fontFamily={font}
        fontSize='25'
        fontWeight='900'
        letterSpacing='-0.6'
      >
        Ahhh, un gim!
      </text>
    </g>
  )
}

function BigText({
  x,
  y,
  children,
  size,
  fill = ink,
  anchor = 'start',
  family = font,
  weight = 950
}: {
  x: number
  y: number
  children: ReactNode
  size: number
  fill?: string
  anchor?: 'start' | 'middle' | 'end'
  family?: string
  weight?: number
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fill={fill}
      fontFamily={family}
      fontSize={size}
      fontWeight={weight}
      letterSpacing={size > 100 ? '-8' : '-2'}
    >
      {children}
    </text>
  )
}

function PosterFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <rect width='1080' height='1920' fill={paper} />
      <rect
        x='30'
        y='30'
        width='1020'
        height='1860'
        fill='none'
        stroke={ink}
        strokeWidth='5'
      />
      {children}
    </>
  )
}

function TodayArtwork({
  dashboard,
  today,
  sticker,
  caption
}: {
  dashboard: Dashboard
  today: string
  sticker: boolean
  caption: string
}) {
  const profileId = dashboard.currentProfileId
  const status = dayStatus(dashboard, profileId, today, today)
  const progress = workoutProgressThisWeek(dashboard, profileId, today)
  const mealCount = status.planned
  const mealsMet = status.met

  if (sticker) {
    return (
      <>
        <rect
          x='70'
          y='120'
          width='940'
          height='740'
          rx='34'
          fill={surface}
          stroke={ink}
          strokeWidth='8'
        />
        <path
          d='M104 124h872a30 30 0 0 1 30 30v171H74V154a30 30 0 0 1 30-30Z'
          fill={coral}
        />
        <BrandLine x={116} y={184} size={48} />
        <BigText x={120} y={286} size={62}>
          {caption}
        </BigText>
        <BigText x={120} y={444} size={104}>
          ENTRENO
        </BigText>
        <BigText x={120} y={552} size={104}>
          HECHO.
        </BigText>
        <line
          x1='120'
          y1='606'
          x2='960'
          y2='606'
          stroke={ink}
          strokeWidth='6'
        />
        <BigText x={120} y={738} size={116} family={mono}>
          {mealsMet}/{mealCount}
        </BigText>
        <text
          x='468'
          y='730'
          fill={ink}
          fontFamily={font}
          fontSize='40'
          fontWeight='900'
        >
          COMIDAS
        </text>
        <text
          x='468'
          y='782'
          fill={ink}
          fontFamily={font}
          fontSize='28'
          fontWeight='700'
        >
          {formatDay(today)}
        </text>
      </>
    )
  }

  return (
    <PosterFrame>
      <BrandLine />
      <text
        x='1004'
        y='110'
        textAnchor='end'
        fill={ink}
        fontFamily={mono}
        fontSize='25'
        fontWeight='700'
      >
        {formatDay(today).toUpperCase()}
      </text>
      <BigText x={72} y={478} size={182}>
        HOY SÍ.
      </BigText>
      <rect
        x='72'
        y='550'
        width='936'
        height='500'
        fill={coral}
        stroke={ink}
        strokeWidth='6'
      />
      <DonutMark x={760} y={600} size={188} />
      <BigText x={120} y={760} size={95}>
        ENTRENO
      </BigText>
      <BigText x={120} y={876} size={116}>
        HECHO.
      </BigText>
      <text
        x='124'
        y='973'
        fill={ink}
        fontFamily={mono}
        fontSize='30'
        fontWeight='700'
      >
        {caption}
      </text>
      <line
        x1='72'
        y1='1130'
        x2='1008'
        y2='1130'
        stroke={ink}
        strokeWidth='6'
      />
      <BigText x={76} y={1314} size={172} family={mono}>
        {mealsMet}/{mealCount}
      </BigText>
      <text
        x='82'
        y='1394'
        fill={ink}
        fontFamily={font}
        fontSize='36'
        fontWeight='900'
      >
        COMIDAS CUMPLIDAS
      </text>
      <rect
        x='76'
        y='1480'
        width='928'
        height='206'
        fill={surface}
        stroke={ink}
        strokeWidth='5'
      />
      <text
        x='112'
        y='1544'
        fill={ink}
        fontFamily={mono}
        fontSize='27'
        fontWeight='700'
      >
        ENTRENOS ESTA SEMANA
      </text>
      <BigText x={112} y={1653} size={94} family={mono}>
        {progress.done}/{progress.target}
      </BigText>
      <text
        x='420'
        y='1648'
        fill={ink}
        fontFamily={font}
        fontSize='32'
        fontWeight='800'
      >
        PASO A PASO.
      </text>
      <line
        x1='76'
        y1='1764'
        x2='1004'
        y2='1764'
        stroke={ink}
        strokeWidth='5'
      />
      <text
        x='76'
        y='1830'
        fill={ink}
        fontFamily={font}
        fontSize='34'
        fontWeight='900'
      >
        MI PROCESO. MI RITMO.
      </text>
      <text
        x='1004'
        y='1830'
        textAnchor='end'
        fill={ink}
        fontFamily={mono}
        fontSize='25'
        fontWeight='700'
      >
        Ahhh, un gim!
      </text>
    </PosterFrame>
  )
}

function StreakArtwork({
  dashboard,
  today,
  sticker,
  caption
}: {
  dashboard: Dashboard
  today: string
  sticker: boolean
  caption: string
}) {
  const profileId = dashboard.currentProfileId
  const meals = consecutiveMealDays(dashboard, profileId, today)
  const weeks = perfectWeekStreak(dashboard, profileId, today)
  const dots = Array.from({ length: 7 }, (_, index) => index < meals)
  const perfectDots = Array.from({ length: 5 }, (_, index) => index < weeks)

  if (sticker) {
    return (
      <>
        <BrandLine x={92} y={138} size={46} />
        <text
          x='1004'
          y='138'
          textAnchor='end'
          fill={ink}
          fontFamily={mono}
          fontSize='23'
          fontWeight='700'
        >
          {formatDay(today).toUpperCase()}
        </text>
        <rect
          x='70'
          y='220'
          width='940'
          height='600'
          rx='34'
          fill={surface}
          stroke={ink}
          strokeWidth='8'
        />
        <path
          d='M104 224h872a30 30 0 0 1 30 30v96H74v-96a30 30 0 0 1 30-30Z'
          fill={coral}
        />
        <line
          x1='74'
          y1='350'
          x2='1006'
          y2='350'
          stroke={ink}
          strokeWidth='8'
        />
        <BigText x={540} y={312} size={58} anchor='middle'>
          DOS RACHAS
        </BigText>
        <line
          x1='540'
          y1='390'
          x2='540'
          y2='682'
          stroke={ink}
          strokeWidth='5'
        />
        <text
          x='298'
          y='430'
          textAnchor='middle'
          fill={ink}
          fontFamily={mono}
          fontSize='26'
          fontWeight='700'
        >
          COMIDAS
        </text>
        <BigText x={298} y={590} size={140} family={mono} anchor='middle'>
          {String(meals)}
        </BigText>
        <text
          x='298'
          y='640'
          textAnchor='middle'
          fill={ink}
          fontFamily={font}
          fontSize='30'
          fontWeight='900'
        >
          DÍAS SEGUIDOS
        </text>
        <text
          x='768'
          y='430'
          textAnchor='middle'
          fill={ink}
          fontFamily={mono}
          fontSize='24'
          fontWeight='700'
        >
          ENTRENO + COMIDAS
        </text>
        <BigText x={768} y={590} size={140} family={mono} anchor='middle'>
          {String(weeks)}
        </BigText>
        <text
          x='768'
          y='640'
          textAnchor='middle'
          fill={ink}
          fontFamily={font}
          fontSize='30'
          fontWeight='900'
        >
          SEMANAS PERFECTAS
        </text>
        {dots.map((on, index) => (
          <circle
            key={`meal-${index}`}
            cx={172 + index * 42}
            cy='690'
            r='12'
            fill={on ? ink : paper}
            stroke={ink}
            strokeWidth='3'
          />
        ))}
        {perfectDots.map((on, index) => (
          <rect
            key={`week-${index}`}
            x={670 + index * 42}
            y='678'
            width='24'
            height='24'
            fill={on ? ink : paper}
            stroke={ink}
            strokeWidth='3'
          />
        ))}
        <line
          x1='120'
          y1='730'
          x2='960'
          y2='730'
          stroke={ink}
          strokeWidth='5'
        />
        <text
          x='540'
          y='785'
          textAnchor='middle'
          fill={ink}
          fontFamily={font}
          fontSize='24'
          fontWeight='800'
        >
          {caption}
        </text>
      </>
    )
  }

  return (
    <PosterFrame>
      <BrandLine />
      <text
        x='1004'
        y='110'
        textAnchor='end'
        fill={ink}
        fontFamily={mono}
        fontSize='25'
        fontWeight='700'
      >
        {formatDay(today).toUpperCase()}
      </text>
      <BigText x={72} y={480} size={120}>
        LA CONSTANCIA
      </BigText>
      <BigText x={72} y={625} size={150}>
        SE CUENTA.
      </BigText>
      <rect
        x='72'
        y='735'
        width='936'
        height='380'
        fill={coral}
        stroke={ink}
        strokeWidth='6'
      />
      <text
        x='118'
        y='804'
        fill={ink}
        fontFamily={mono}
        fontSize='28'
        fontWeight='700'
      >
        COMIDAS · DÍAS SEGUIDOS
      </text>
      <BigText x={115} y={1010} size={172} family={mono}>
        {String(meals)}
      </BigText>
      {dots.map((on, index) => (
        <circle
          key={index}
          cx={660 + index * 42}
          cy='978'
          r='14'
          fill={on ? ink : surface}
          stroke={ink}
          strokeWidth='4'
        />
      ))}
      <text
        x='658'
        y='1032'
        fill={ink}
        fontFamily={font}
        fontSize='26'
        fontWeight='800'
      >
        ÚLTIMOS 7
      </text>
      <rect
        x='72'
        y='1155'
        width='936'
        height='380'
        fill={yellow}
        stroke={ink}
        strokeWidth='6'
      />
      <text
        x='118'
        y='1224'
        fill={ink}
        fontFamily={mono}
        fontSize='28'
        fontWeight='700'
      >
        ENTRENO + COMIDAS · SEMANAS
      </text>
      <BigText x={115} y={1430} size={172} family={mono}>
        {String(weeks)}
      </BigText>
      {perfectDots.map((on, index) => (
        <rect
          key={index}
          x={660 + index * 54}
          y='1372'
          width='34'
          height='34'
          fill={on ? ink : surface}
          stroke={ink}
          strokeWidth='4'
        />
      ))}
      <text
        x='658'
        y='1450'
        fill={ink}
        fontFamily={font}
        fontSize='26'
        fontWeight='800'
      >
        SEMANA PERFECTA
      </text>
      <line
        x1='76'
        y1='1670'
        x2='1004'
        y2='1670'
        stroke={ink}
        strokeWidth='5'
      />
      <text
        x='76'
        y='1754'
        fill={ink}
        fontFamily={font}
        fontSize='42'
        fontWeight='900'
      >
        {caption}
      </text>
      <text
        x='76'
        y='1830'
        fill={ink}
        fontFamily={mono}
        fontSize='25'
        fontWeight='700'
      >
        Ahhh, un gim! · {formatDay(today).toUpperCase()}
      </text>
    </PosterFrame>
  )
}

function RaceArtwork({
  score,
  today,
  dashboard,
  sticker,
  caption
}: {
  score: MonthResult
  today: string
  dashboard: Dashboard
  sticker: boolean
  caption: string
}) {
  const me = score.participants.find(
    (item) => item.profileId === dashboard.currentProfileId
  )
  const rivals = score.participants.filter(
    (item) => item.profileId !== dashboard.currentProfileId
  )
  const topRival = rivals.reduce<typeof rivals[number] | undefined>(
    (best, item) => (item.total > (best?.total ?? -Infinity) ? item : best),
    undefined
  )
  const left = me ?? score.participants[0]
  const right = topRival ?? score.participants[1]
  const rightLabel = right?.name ? right.name.toUpperCase().slice(0, 12) : 'LA CIMA'
  const leftTotal = left?.total ?? 0
  const rightTotal = right?.total ?? 0
  const maxPoints = 116
  const outcome =
    leftTotal === rightTotal
      ? 'EMPATE'
      : leftTotal > rightTotal
        ? 'VOY ARRIBA'
        : 'VOY POR MÁS'
  const formatted = (value: number) =>
    Number.isInteger(value) ? String(value) : value.toFixed(1)

  if (sticker) {
    return (
      <>
        <BrandLine x={96} y={142} size={46} />
        <rect
          x='70'
          y='220'
          width='940'
          height='600'
          rx='34'
          fill={surface}
          stroke={ink}
          strokeWidth='8'
        />
        <path
          d='M104 224h872a30 30 0 0 1 30 30v96H74v-96a30 30 0 0 1 30-30Z'
          fill={coral}
        />
        <line
          x1='74'
          y1='350'
          x2='1006'
          y2='350'
          stroke={ink}
          strokeWidth='8'
        />
        <BigText x={540} y={312} size={58} anchor='middle'>
          LA CARRERA.
        </BigText>
        <text
          x='540'
          y='392'
          textAnchor='middle'
          fill={ink}
          fontFamily={mono}
          fontSize='22'
          fontWeight='700'
        >
          {formatMonth(score.monthKey).toUpperCase()} · DÍA{' '}
          {Number(today.slice(8, 10))}
        </text>
        <rect
          x='90'
          y='420'
          width='440'
          height='286'
          fill={coral}
          stroke={ink}
          strokeWidth='6'
        />
        <rect
          x='550'
          y='420'
          width='440'
          height='286'
          fill={blue}
          stroke={ink}
          strokeWidth='6'
        />
        <text
          x='310'
          y='490'
          textAnchor='middle'
          fill={ink}
          fontFamily={font}
          fontSize='30'
          fontWeight='900'
        >
          YO
        </text>
        <text
          x='770'
          y='490'
          textAnchor='middle'
          fill={surface}
          fontFamily={font}
          fontSize='30'
          fontWeight='900'
        >
          {rightLabel}
        </text>
        <BigText x={310} y={622} size={100} family={mono} anchor='middle'>
          {formatted(leftTotal)}
        </BigText>
        <BigText
          x={770}
          y={622}
          size={100}
          family={mono}
          fill={surface}
          anchor='middle'
        >
          {formatted(rightTotal)}
        </BigText>
        <text
          x='310'
          y='672'
          textAnchor='middle'
          fill={ink}
          fontFamily={mono}
          fontSize='24'
          fontWeight='700'
        >
          PUNTOS
        </text>
        <text
          x='770'
          y='672'
          textAnchor='middle'
          fill={surface}
          fontFamily={mono}
          fontSize='24'
          fontWeight='700'
        >
          PUNTOS
        </text>
        <text
          x='540'
          y='742'
          textAnchor='middle'
          fill={ink}
          fontFamily={font}
          fontSize='36'
          fontWeight='900'
        >
          {outcome}
        </text>
        <text
          x='540'
          y='786'
          textAnchor='middle'
          fill={ink}
          fontFamily={mono}
          fontSize='23'
          fontWeight='700'
        >
          {caption}
        </text>
      </>
    )
  }

  return (
    <PosterFrame>
      <BrandLine />
      <text
        x='1004'
        y='110'
        textAnchor='end'
        fill={ink}
        fontFamily={mono}
        fontSize='25'
        fontWeight='700'
      >
        {formatMonth(score.monthKey).toUpperCase()}
      </text>
      <BigText x={72} y={300} size={150}>
        LA CARRERA.
      </BigText>
      <rect
        x='72'
        y='390'
        width='456'
        height='570'
        fill={coral}
        stroke={ink}
        strokeWidth='6'
      />
      <rect
        x='552'
        y='390'
        width='456'
        height='570'
        fill={blue}
        stroke={ink}
        strokeWidth='6'
      />
      <text
        x='118'
        y='470'
        fill={ink}
        fontFamily={font}
        fontSize='42'
        fontWeight='900'
      >
        YO
      </text>
      <text
        x='598'
        y='470'
        fill={surface}
        fontFamily={font}
        fontSize='42'
        fontWeight='900'
      >
        {rightLabel}
      </text>
      <BigText x={118} y={680} size={140} family={mono}>
        {formatted(leftTotal)}
      </BigText>
      <BigText x={598} y={680} size={140} family={mono} fill={surface}>
        {formatted(rightTotal)}
      </BigText>
      <text
        x='122'
        y='740'
        fill={ink}
        fontFamily={mono}
        fontSize='30'
        fontWeight='700'
      >
        PUNTOS
      </text>
      <text
        x='602'
        y='740'
        fill={surface}
        fontFamily={mono}
        fontSize='30'
        fontWeight='700'
      >
        PUNTOS
      </text>
      <rect
        x='120'
        y='810'
        width={Math.max(0, 360 * Math.min(1, leftTotal / maxPoints))}
        height='28'
        fill={ink}
      />
      <rect
        x='600'
        y='810'
        width={Math.max(0, 360 * Math.min(1, rightTotal / maxPoints))}
        height='28'
        fill={surface}
      />
      <text
        x='540'
        y='1055'
        textAnchor='middle'
        fill={ink}
        fontFamily={mono}
        fontSize='36'
        fontWeight='800'
      >
        {outcome}
      </text>
      <text
        x='540'
        y='1120'
        textAnchor='middle'
        fill={ink}
        fontFamily={font}
        fontSize='36'
        fontWeight='800'
      >
        {caption}
      </text>
      <line
        x1='76'
        y1='1265'
        x2='1004'
        y2='1265'
        stroke={ink}
        strokeWidth='5'
      />
      <BigText x={76} y={1430} size={100}>
        {Number(today.slice(8, 10))}
      </BigText>
      <text
        x='252'
        y='1422'
        fill={ink}
        fontFamily={mono}
        fontSize='27'
        fontWeight='700'
      >
        DÍA DEL MES
      </text>
      <text
        x='76'
        y='1640'
        fill={ink}
        fontFamily={font}
        fontSize='43'
        fontWeight='900'
      >
        EL PROCESO TAMBIÉN SE CELEBRA.
      </text>
      <text
        x='76'
        y='1830'
        fill={ink}
        fontFamily={mono}
        fontSize='25'
        fontWeight='700'
      >
        Ahhh, un gim!
      </text>
    </PosterFrame>
  )
}

export function SharePoster({
  dashboard,
  today,
  score,
  kind,
  format,
  caption,
  ref
}: {
  dashboard: Dashboard
  today: string
  score: MonthResult
  kind: ShareCardKind
  format: ShareFormat
  caption: string
  ref?: Ref<SVGSVGElement>
}) {
  const height = format === 'story' ? 1920 : 980
  const label =
    kind === 'today'
      ? 'Mi entrenamiento de hoy'
      : kind === 'streak'
        ? 'Mis rachas'
        : 'La carrera del mes'

  return (
    <svg
      ref={ref}
      className='share-poster'
      xmlns='http://www.w3.org/2000/svg'
      width='1080'
      height={height}
      viewBox={`0 0 1080 ${height}`}
      role='img'
      aria-label={`${label}, ${format === 'story' ? 'historia' : 'sticker'} de Ahhh, un gim!`}
      preserveAspectRatio='xMidYMid meet'
    >
      {kind === 'today' && (
        <TodayArtwork
          dashboard={dashboard}
          today={today}
          sticker={format === 'sticker'}
          caption={caption}
        />
      )}
      {kind === 'streak' && (
        <StreakArtwork
          dashboard={dashboard}
          today={today}
          sticker={format === 'sticker'}
          caption={caption}
        />
      )}
      {kind === 'race' && (
        <RaceArtwork
          dashboard={dashboard}
          today={today}
          score={score}
          sticker={format === 'sticker'}
          caption={caption}
        />
      )}
      {format === 'sticker' && (
        <metadata>{`${label} · ${formatDay(today)} · Anónimo`}</metadata>
      )}
    </svg>
  )
}
