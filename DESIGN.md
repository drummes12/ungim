# Design

## Mode

Operate. The app must let either partner finish daily registration in seconds, understand sync state honestly, and read the competition without decoration getting in the way.

## Visual world

Warm iOS consumer app with a playful donut identity: cream ground, opaque soft-cornered cards, one saturated coral action color, dark athletic score surfaces, and authored SVG donut rewards. The interface favors familiar native patterns over novelty: bottom thumb navigation, large touch targets, inline corrections, and plain Spanish labels.

## Typography

System rounded/sans stack (`ui-rounded`, SF Pro Rounded, Avenir Next, system fallbacks). Large headings use heavy weight and tight tracking for a sporty voice; controls, labels, and data remain in the same family at practical sizes. Numeric score values use oversized high-contrast text inside the participant cards.

## Color tokens

- Ground: warm cream `#fff4e8` to `#ffe7d5`
- Surface: warm white `#fffdf8`
- Ink: `#21130f`
- Muted text: `#6f5f57`
- Primary action: coral `#f05a43`, dark `#cb3f31`
- Donut accent: pink `#ff75a8`, yellow `#ffd447`
- Partner accents: coral `#f05a43`, blue `#2f6fdd`
- Success: green `#278b61`

Coral is reserved for actual actions, active navigation, and competition status. Secondary controls remain warm neutrals.

## Layout and components

- Mobile-first shell capped around a phone-sized column, with safe-area-aware fixed status and bottom navigation.
- Cards are opaque, tactile, and grouped by task; controls are inline rather than modal.
- Today uses a heading, compact month metrics, direct yes/no meal controls, a one-tap workout action, and an optional details form.
- Scoreboard compares both people side by side in stacked cards, separates base/bonus/streak, and reserves the dark close card for month-ending action.
- History exposes open/closed months, snapshots, and expandable editable days.
- Plan setup is a single form for name, shared timezone, workout target, and 1–5 meal rules.

## Interaction states

All interactive controls are at least 44px high, show pressed states, visible focus, disabled states, and real sync status. Hover is restricted to fine pointers. Errors and pending operations remain visible; the app does not claim silent synchronization.

## Motion and accessibility

Motion is limited to short state feedback and a single screen transition, with reduced-motion support. Contrast, keyboard access, form labels, safe-area insets, `100dvh`, and touch manipulation are required. No copyrighted Simpsons characters or assets; the personality comes from original donut icons and copy.
