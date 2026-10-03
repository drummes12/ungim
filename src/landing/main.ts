import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

const authParams = new URLSearchParams(window.location.search)
if (authParams.has('token_hash') || authParams.has('code'))
  window.location.replace(`/app${window.location.search}`)

gsap.registerPlugin(ScrollTrigger)

const mm = gsap.matchMedia()

mm.add('(prefers-reduced-motion: no-preference)', () => {
  const donut = document.querySelector<HTMLElement>('.hero-donut svg')

  /* ── Hero entrance ─────────────────────────────────── */

  const intro = gsap.timeline({ defaults: { ease: 'power4.out' } })
  intro
    .from('.topbar', { y: -32, opacity: 0, duration: 0.6 }, 0)
    .from(
      '.hero-title .word',
      { yPercent: 115, duration: 1, stagger: 0.09 },
      0.15
    )
    .from('.hero-sub', { y: 24, opacity: 0, duration: 0.7 }, 0.6)
    .from('.scroll-hint', { opacity: 0, duration: 0.6 }, 1.1)
    .from(
      '.sprinkle',
      {
        scale: 0,
        opacity: 0,
        duration: 0.7,
        ease: 'back.out(2.2)',
        stagger: { each: 0.05, from: 'random' }
      },
      0.5
    )

  if (donut) {
    gsap.set(donut, { transformOrigin: '50% 100%' })
    const fall = gsap.timeline({ delay: 0.35 })
    fall
      .from(donut, {
        y: '-160vh',
        rotation: -300,
        duration: 1.15,
        ease: 'power2.in'
      })
      .to(donut, { scaleY: 0.78, scaleX: 1.18, duration: 0.09 })
      .to(donut, {
        scaleX: 1,
        scaleY: 1,
        duration: 0.7,
        ease: 'elastic.out(1, 0.35)',
        onComplete: () =>
          gsap.to(donut, {
            y: -10,
            rotation: 6,
            duration: 2.4,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true
          })
      })
  }

  /* ── Sprinkle mouse parallax ───────────────────────── */

  const hero = document.querySelector<HTMLElement>('.hero')
  if (hero && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const shifters = gsap.utils.toArray<HTMLElement>('.sprinkle').map((el) => ({
      x: gsap.quickTo(el, 'x', { duration: 0.9, ease: 'power2.out' }),
      y: gsap.quickTo(el, 'y', { duration: 0.9, ease: 'power2.out' }),
      depth: Number(el.dataset.depth ?? 1)
    }))
    hero.addEventListener('pointermove', (event) => {
      const dx = event.clientX / window.innerWidth - 0.5
      const dy = event.clientY / window.innerHeight - 0.5
      for (const s of shifters) {
        s.x(dx * 90 * s.depth)
        s.y(dy * 90 * s.depth)
      }
    })
  }

  /* ── Horizontal journey ────────────────────────────── */

  const wrap = document.querySelector<HTMLElement>('.h-wrap')
  const track = wrap?.querySelector<HTMLElement>('.h-track')
  const runner = wrap?.querySelector<HTMLElement>('.runner-donut')
  const runnerSvg = runner?.querySelector<SVGElement>('svg')
  let journey: gsap.core.Timeline | undefined

  if (wrap && track && runner && runnerSvg) {
    wrap.classList.add('is-pinned')
    gsap.set(runner, { x: 0 })
    gsap.set(runnerSvg, { transformOrigin: '50% 50%' })

    const panels = gsap.utils.toArray<HTMLElement>('.h-panel')
    const travel = () => {
      const last = panels[panels.length - 1]
      return last.offsetLeft + last.offsetWidth - wrap.clientWidth
    }
    const run = () => window.innerWidth * 0.66
    const spin = () => (run() / (runner.offsetWidth * Math.PI)) * 360
    const hold = () => window.innerHeight * 0.5

    ScrollTrigger.create({
      trigger: wrap,
      start: 'top top',
      end: () => `+=${travel() + hold()}`,
      pin: true,
      anticipatePin: 1
    })

    journey = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: wrap,
        start: 'top top',
        end: () => `+=${travel()}`,
        scrub: 0.6,
        invalidateOnRefresh: true
      }
    })

    journey
      .to(track, { x: () => -travel(), duration: 1 }, 0)
      .to(runner, { x: run, duration: 1 }, 0)
      .to(runnerSvg, { rotation: spin, duration: 1 }, 0)

    for (const hopAt of [0.3, 0.55, 0.8]) {
      journey
        .to(runner, { y: -30, duration: 0.035, ease: 'power1.out' }, hopAt)
        .to(runner, { y: 0, duration: 0.045, ease: 'power2.in' }, hopAt + 0.035)
    }

    for (const panel of panels) {
      gsap.fromTo(
        panel.querySelectorAll('.h-num, h2, p'),
        { x: 60, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          ease: 'none',
          stagger: 0.08,
          scrollTrigger: {
            trigger: panel,
            containerAnimation: journey,
            start: 'left 90%',
            end: 'left 50%',
            scrub: true
          }
        }
      )

      const icon = panel.querySelector<SVGElement>('.h-icon')
      if (icon) {
        gsap.from(icon, {
          scale: 0.65,
          opacity: 0,
          duration: 0.38,
          ease: 'back.out(2.2)',
          scrollTrigger: {
            trigger: icon,
            containerAnimation: journey,
            start: 'left 92%',
            toggleActions: 'play none none reverse'
          }
        })
      }
    }
  }

  /* ── Panel icon loops ──────────────────────────────── */

  const dumbbell = document.querySelector<SVGElement>('.icon-dumbbell')
  if (dumbbell) {
    gsap.to(dumbbell, {
      rotation: -9,
      transformOrigin: '50% 60%',
      duration: 1.4,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true
    })
    gsap.to(dumbbell.querySelector('.plate-l'), {
      rotation: 8,
      svgOrigin: '10 32',
      duration: 0.42,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true
    })
    gsap.to(dumbbell.querySelector('.plate-r'), {
      rotation: -8,
      svgOrigin: '54 32',
      duration: 0.42,
      delay: 0.12,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true
    })
  }

  const biteGroups = gsap.utils
    .toArray<SVGCircleElement>('.icon-bite .bite')
    .map((bite, i) => [
      bite,
      document.querySelectorAll<SVGCircleElement>('.icon-bite .bite-rim')[i]
    ])
  const crumbs = gsap.utils.toArray<SVGCircleElement>('.icon-bite .crumb')
  const biteIcon = document.querySelector<SVGElement>('.icon-bite')
  if (biteGroups.length && biteIcon && journey) {
    const meal = gsap.timeline({
      scrollTrigger: {
        trigger: biteIcon,
        containerAnimation: journey,
        start: 'left 70%',
        end: 'left 35%',
        scrub: true
      }
    })
    biteGroups.forEach((group, i) => {
      const at = i * 0.42
      meal.from(
        group,
        {
          scale: 0,
          transformOrigin: '50% 50%',
          duration: 0.2,
          ease: 'back.out(3.5)'
        },
        at
      )
      if (crumbs[i])
        meal.fromTo(
          crumbs[i],
          { opacity: 1, y: -2 },
          { opacity: 0, y: 22, duration: 0.5, ease: 'power1.in' },
          at + 0.08
        )
    })
    if (crumbs[3])
      meal.fromTo(
        crumbs[3],
        { opacity: 1, y: -2 },
        { opacity: 0, y: 22, duration: 0.5, ease: 'power1.in' },
        0.92
      )
  }

  gsap.to('.icon-sync .a1', {
    x: 6,
    duration: 0.8,
    ease: 'sine.inOut',
    repeat: -1,
    yoyo: true
  })
  gsap.to('.icon-sync .a2', {
    x: -6,
    duration: 0.8,
    ease: 'sine.inOut',
    repeat: -1,
    yoyo: true
  })

  gsap.to('.icon-stack', {
    y: -9,
    duration: 1.7,
    ease: 'sine.inOut',
    repeat: -1,
    yoyo: true
  })

  /* ── Scroll reveals ────────────────────────────────── */

  for (const sel of ['.score-title', '.invite-title']) {
    gsap.from(`${sel} .word`, {
      yPercent: 115,
      duration: 0.9,
      ease: 'power4.out',
      stagger: 0.09,
      scrollTrigger: {
        trigger: sel,
        start: 'top 90%',
        toggleActions: 'play none none reverse'
      }
    })
  }

  gsap.from('.score-card', {
    y: 56,
    opacity: 0,
    duration: 0.8,
    ease: 'power4.out',
    stagger: 0.12,
    scrollTrigger: {
      trigger: '.score-grid',
      start: 'top 92%',
      toggleActions: 'play none none reverse'
    }
  })

  for (const fill of gsap.utils.toArray<HTMLElement>('.bar-fill')) {
    gsap.from(fill, {
      scaleX: 0,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: fill,
        start: 'top 95%',
        toggleActions: 'play none none reverse'
      }
    })
  }

  gsap.from('.score-donuts svg use', {
    scale: 0,
    rotation: -120,
    transformOrigin: '50% 50%',
    duration: 0.7,
    ease: 'back.out(2.4)',
    stagger: 0.12,
    scrollTrigger: {
      trigger: '.score-card-donut',
      start: 'top 92%',
      toggleActions: 'play none none reverse'
    }
  })

  gsap.from('.score-note', {
    opacity: 0,
    y: 18,
    duration: 0.6,
    ease: 'power4.out',
    scrollTrigger: {
      trigger: '.score-note',
      start: 'top 98%',
      toggleActions: 'play none none reverse'
    }
  })

  const card = document.querySelector<HTMLElement>('.invite-card')
  if (card) {
    gsap.from(card, {
      y: 64,
      rotation: 1.5,
      opacity: 0,
      duration: 0.9,
      ease: 'power4.out',
      scrollTrigger: {
        trigger: card,
        start: 'top 90%',
        toggleActions: 'play none none reverse'
      }
    })
    const cardDonut = card.querySelector('.invite-donut use')
    if (cardDonut)
      gsap.to(cardDonut, {
        rotation: 360,
        transformOrigin: '50% 50%',
        duration: 14,
        ease: 'none',
        repeat: -1
      })
  }

  return () => {
    wrap?.classList.remove('is-pinned')
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill())
    gsap.killTweensOf('*')
  }
})

window.addEventListener('load', () => ScrollTrigger.refresh())
