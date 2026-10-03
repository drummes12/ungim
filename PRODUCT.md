# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated: Vite + React + TypeScript, Supabase Auth/PostgreSQL/RLS/Realtime, Workbox via `vite-plugin-pwa`, IndexedDB, Vitest, and Playwright. The user approved this stack for a lightweight mobile-first PWA with offline persistence and a free static host; Cloudflare Pages is the planned deployment target, pending explicit deployment authorization.

## Users

A private household competition for two partners. Each person uses their own phone, wants registration to take at most two taps, and may be offline when logging workouts or meals.

## Product Purpose

Track adherence to each person's exercise and meal plan and turn it into a fair monthly competition. Success means both users can quickly record today's obligations, see a live scoreboard and streaks, and close a month with an immutable winner or tie.

## Positioning

Unlike a generic tracker, the product compares percentage-based adherence across two different personal plans and presents it as a playful household contest with donuts and the product's own “¡Ahhh, un gim!” voice.

## Operating Context

Mobile-first PWA intended to be installed on iPhones, used daily in short sessions, and synchronized when connectivity returns. Exercise is one session maximum per local date; meals are configured per user and judged against a saved short rule. Weeks run Monday through Sunday and dates/months use one shared home IANA timezone.

## Capabilities and Constraints

- Two controlled email/password accounts; no public signup in the MVP.
- Each profile has 1–7 weekly workouts and 1–5 named meals with a short rule.
- Entries can be corrected for open months, but never future dates; plan changes start the next ISO week and remain versioned.
- Monthly score is `50 × workout adherence + 50 × meal adherence`, plus two donuts for each completed perfect week ending in the month, capped at ten donuts.
- Both users must confirm a month before it closes; a change before full confirmation resets confirmations.
- Offline writes must persist locally and synchronize without duplication; Safari/iOS cannot be assumed to support Background Sync, so foreground reopening is the reliable trigger.
- Free Supabase usage may pause for low activity; the app must communicate sync state honestly.
- Future group competitions, macros, detailed workouts, and push reminders are out of scope and must not be scaffolded as active features.

## Brand Commitments

Name: “Ahhh Un Gim!”. Personality is playful, energetic, and game-like, with donuts as the reward metaphor and “¡Ahhh, un gim!” as the workout-completion easter egg. No copyrighted Simpsons characters or imagery. Visual references supplied by the user: jjettas.com, miralife.app, butter.video, and subscrr.app. Desired feel: premium iOS-native, not a generic tracker. The household asked for brutalist minimalism on iOS structure, real charts for a visually driven partner, desktop parity, and bottom-sheet modals.

## Evidence on Hand

No prior code, product copy, logo, icons, or real user data exist. Product rules and target audience were confirmed through the planning questions; illustrative values must be clearly identified during development and replaced by actual records.

## Product Principles

- Speed beats granularity: common actions require one or two taps.
- Fairness beats raw totals: adherence is normalized across differing plans.
- Offline honesty beats pretending data is synchronized.
- Playful identity supports the habit loop but never hides status, errors, or pending work.
- The MVP stays private and deliberately avoids roles, organizations, macros, detailed workout programming, and notification infrastructure.
