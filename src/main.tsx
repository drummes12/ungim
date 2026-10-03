import {
  StrictMode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties
} from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { PwaNotices } from './components/PwaNotices'
import { notifySwUpdate } from './lib/pwa'
import './styles.css'

registerSW({ immediate: true, onNeedReload: notifySwUpdate })

const FROSTING =
  'M6 32c0-6.5 5-9.6 10.4-8.9 4.3.6 5.6 5.2 10.2 4.7 5-.5 4.6-6.4 10.8-6.4 5.2 0 7 4.3 10.7 4.8 4 .5 9.9-2 9.9 6A26.9 26.9 0 0 1 32 58 26.9 26.9 0 0 1 6 32Z'

const CHIPS = [
  { x: 19.8, y: 24.6, rot: 28, d: 620, fill: '#fffdf9' },
  { x: 40.7, y: 21.1, rot: 65, d: 660, fill: '#fffdf9' },
  { x: 50.6, y: 31.1, rot: 26, d: 700, fill: '#fffdf9' },
  { x: 21.1, y: 38.6, rot: -14, d: 740, fill: '#fffdf9' },
  { x: 39.2, y: 43.4, rot: -46, d: 780, fill: '#fffdf9' },
  { x: 14.1, y: 28.6, rot: -46, d: 820, fill: '#ffe08f' },
  { x: 48.9, y: 44.2, rot: 51, d: 860, fill: '#ffe08f' }
]

function Launch() {
  const [ready, setReady] = useState(false)
  const [zooming, setZooming] = useState(false)
  const [visible, setVisible] = useState(true)
  const mountAt = useRef(0)
  const onReady = useCallback(() => setReady(true), [])

  useEffect(() => {
    mountAt.current = Date.now()
  }, [])

  useEffect(() => {
    if (!ready) return
    const wait = Math.max(0, 1450 - (Date.now() - mountAt.current))
    const timer = window.setTimeout(() => setZooming(true), wait)
    return () => window.clearTimeout(timer)
  }, [ready])

  useEffect(() => {
    if (!zooming) return
    const timer = window.setTimeout(() => setVisible(false), 950)
    return () => window.clearTimeout(timer)
  }, [zooming])

  return (
    <>
      <App onReady={onReady} />
      <PwaNotices />
      {visible && <LaunchScreen zooming={zooming} />}
    </>
  )
}

function LaunchScreen({ zooming }: { zooming: boolean }) {
  const maskId = useId().replace(/:/g, '')
  return (
    <div
      className={`launch-screen${zooming ? ' is-zooming' : ''}`}
      role={zooming ? undefined : 'status'}
      aria-label={zooming ? undefined : 'Cargando Ahhh Un Gim'}
      aria-hidden={zooming || undefined}
    >
      <div className='launch-surface' />
      <svg className='launch-donut' viewBox='0 0 64 64' aria-hidden='true'>
        <mask id={maskId}>
          <circle cx='32' cy='32' r='27' fill='#ffffff' />
          <circle cx='32' cy='32' r='8' fill='#000000' />
        </mask>
        <g mask={`url(#${maskId})`}>
          <circle cx='32' cy='32' r='27' fill='#e8a961' />
          <path className='launch-frost' d={FROSTING} fill='#ffb3c9' />
          {CHIPS.map((chip) => (
            <rect
              key={`${chip.x}-${chip.y}`}
              className='launch-chip'
              x={chip.x - 3.5}
              y={chip.y - 1.5}
              width='7'
              height='3'
              rx='1.5'
              fill={chip.fill}
              style={
                {
                  '--rot': `${chip.rot}deg`,
                  '--d': `${chip.d}ms`
                } as CSSProperties
              }
            />
          ))}
        </g>
        <circle
          cx='32'
          cy='32'
          r='27'
          fill='none'
          stroke='#14110f'
          strokeWidth='3'
        />
        <circle
          cx='32'
          cy='32'
          r='8'
          fill='none'
          stroke='#14110f'
          strokeWidth='3'
        />
      </svg>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Launch />
  </StrictMode>
)
