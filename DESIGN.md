# Design

## Mode

Operate. Either partner finishes the day's registration in seconds on a phone, and reads the month's race at a glance on a phone or a desktop browser. Expression lives in precise details, not in decoration.

## Visual world

Brutalist minimalism on iOS bones. A warm paper ground, flat surfaces ruled with 2px ink borders, almost no ornament, and one saturated coral reserved for action and the live race. Tappable things carry a hard offset shadow that collapses when pressed; everything else is flat. Information is drawn, not just numbered: every number has a shape beside it (bars, a daily grid, a race line, a week strip). Donuts are the only illustration and stay small and authored.

Structure follows iOS: opaque bottom tab bar on phones (49pt, hairline top rule, icon over label, tinted active state, no glass), bottom sheets for every secondary task, large titles, inset lists. On desktop the same navigation becomes a left sidebar and content opens into a two-column workspace.

## Typography

System stack (`-apple-system`, SF Pro, `system-ui`) so the app reads as native on iPhone. Titles are black-weight with tight tracking (never below -0.04em); body is regular and 15-16px. Scores, dates and counters use `ui-monospace` with tabular numerals because they are measurements. No eyebrow labels above headings; headings carry themselves.

## Color tokens

- Paper: `#faf1e7`; Surface: `#fffdf9`; Ink: `#14110f`; Muted: `#6b6156`
- Coral (action, live race, Ana by default): pastel `#ff9078`, text `#b8462c`
- Blue (second partner by default, focus ring): `#557fd8`
- Donut frosting pink `#ffb3c9` (donut bonus), pastel yellow `#ffe08f` (leader, workout done)
- Mint `#abe7c2` (meal met); warning amber `#ffefc4`

Participant colors in charts come from each profile's stored `avatar_color`. Text on coral is ink, never white (contrast).

## Layout and components

- Phone: sticky top bar (sync state left, account avatar right), single column, bottom tab bar with Hoy / Marcador / Historial.
- Desktop (>= 960px): sidebar navigation with brand, nav, sync state and account; content max 1200px in a two-column grid (day editor + race on Today, charts + month grids on Marcador).
- Sheets: native `<dialog>` that rises from the bottom on phones (grabber, drag to dismiss with velocity projection, scrim) and appears as a centered dialog on desktop. Used for plan editing, workout details, day editing from History, account, and month-close confirmation.
- Charts: DuelBar (stacked exercise + meals + donut bonus per person), TrendChart (cumulative score line per day for both), MonthGrid (calendar of daily meal fill and workout mark, tappable), WeekStrip (7 days of the current week).

## Interaction states

Controls are at least 44px, press on pointer-down with a collapsing hard shadow, visible focus ring in blue, disabled at 48% opacity. Hover only for `(hover: hover) and (pointer: fine)`. Sync errors stay visible until resolved.

## Motion

One authored moment per screen: charts draw once on entry (bars scale from the left, the race line strokes in, grid cells fade in a short stagger), sheets rise with the iOS drawer curve `cubic-bezier(0.32, 0.72, 0, 1)` and reverse on exit, and the workout stamp plays when a workout is first logged. Everything else is a 100-160ms transition. `prefers-reduced-motion` replaces movement with a short fade.

## Accessibility

Contrast >= 4.5:1 for text, labelled controls, focus-visible rings, dialog focus trap and Esc to close, safe-area insets, `100dvh`, charts expose an accessible text equivalent. No copyrighted Simpsons characters or assets.
