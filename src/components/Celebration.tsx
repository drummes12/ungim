import { useId, useLayoutEffect, useRef } from 'react'
import type { CSSProperties } from 'react'

const FROSTING_PATH =
  'M6 32c0-6.5 5-9.6 10.4-8.9 4.3.6 5.6 5.2 10.2 4.7 5-.5 4.6-6.4 10.8-6.4 5.2 0 7 4.3 10.7 4.8 4 .5 9.9-2 9.9 6A26.9 26.9 0 0 1 32 58 26.9 26.9 0 0 1 6 32Z'

const RAIN = [
  { x: 73, y: 87.5, rot: 27, d: 480, fill: '#fffdf9' },
  { x: 119, y: 80, rot: 64, d: 540, fill: '#fffdf9' },
  { x: 141, y: 102, rot: 27, d: 600, fill: '#fffdf9' },
  { x: 76, y: 118.5, rot: -15, d: 660, fill: '#fffdf9' },
  { x: 116, y: 129, rot: -44, d: 700, fill: '#fffdf9' },
  { x: 60, y: 96.5, rot: -46, d: 760, fill: '#ffe08f' },
  { x: 138, y: 131, rot: 52, d: 820, fill: '#ffe08f' }
]

const BURST = [
  { x: 94, y: 30, tx: -64, ty: -46, rot: -50, d: 250, fill: '#ffb3c9' },
  { x: 100, y: 24, tx: 70, ty: -52, rot: 40, d: 290, fill: '#ffe08f' },
  { x: 96, y: 40, tx: -84, ty: 18, rot: 70, d: 330, fill: '#fffdf9' },
  { x: 104, y: 38, tx: 88, ty: 24, rot: -35, d: 370, fill: '#ffb3c9' },
  { x: 90, y: 46, tx: -58, ty: 62, rot: 25, d: 410, fill: '#ffe08f' },
  { x: 108, y: 48, tx: 62, ty: 58, rot: -60, d: 450, fill: '#fffdf9' },
  { x: 98, y: 20, tx: -30, ty: -72, rot: 15, d: 300, fill: '#fffdf9' },
  { x: 102, y: 18, tx: 36, ty: -68, rot: -25, d: 350, fill: '#ffb3c9' }
]

export function Celebration() {
  const maskId = useId().replace(/:/g, '')
  const overlayRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const overlay = overlayRef.current
    if (overlay && !overlay.matches(':popover-open')) overlay.showPopover()
  }, [])

  return (
    <div
      ref={overlayRef}
      className='celebrate'
      popover='manual'
      aria-hidden='true'
      onAnimationEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          event.animationName === 'celebrate-fade'
        )
          event.currentTarget.hidePopover()
      }}
    >
      <svg className='celebrate-svg' viewBox='0 0 200 200'>
        <mask id={maskId}>
          <circle cx='100' cy='104' r='60' fill='#ffffff' />
          <circle cx='100' cy='104' r='18' fill='#000000' />
        </mask>
        {BURST.map((sprinkle, index) => (
          <rect
            key={`burst-${index}`}
            className='sprinkle-burst'
            x={sprinkle.x}
            y={sprinkle.y}
            width='14'
            height='5'
            rx='2.5'
            fill={sprinkle.fill}
            style={
              {
                '--tx': `${sprinkle.tx}px`,
                '--ty': `${sprinkle.ty}px`,
                '--rot': `${sprinkle.rot}deg`,
                '--d': `${sprinkle.d}ms`
              } as CSSProperties
            }
          />
        ))}
        <g className='celebrate-donut'>
          <g mask={`url(#${maskId})`}>
            <circle cx='100' cy='104' r='60' fill='#e8a961' />
            <g className='frost-wrap'>
              <path
                transform='translate(100 104) scale(2.22) translate(-32 -32)'
                d={FROSTING_PATH}
                fill='#ffb3c9'
              />
            </g>
            {RAIN.map((sprinkle, index) => (
              <rect
                key={`rain-${index}`}
                className='sprinkle-rain'
                x={sprinkle.x - 7}
                y={sprinkle.y - 2.5}
                width='14'
                height='5'
                rx='2.5'
                fill={sprinkle.fill}
                style={
                  {
                    '--rot': `${sprinkle.rot}deg`,
                    '--d': `${sprinkle.d}ms`
                  } as CSSProperties
                }
              />
            ))}
          </g>
          <circle
            cx='100'
            cy='104'
            r='60'
            fill='none'
            stroke='#14110f'
            strokeWidth='5'
          />
          <circle
            cx='100'
            cy='104'
            r='18'
            fill='none'
            stroke='#14110f'
            strokeWidth='5'
          />
        </g>
      </svg>
      <strong className='celebrate-word'>¡Ahhh, un gim!</strong>
    </div>
  )
}
