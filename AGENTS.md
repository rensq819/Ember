# AGENTS.md — Ember

Working notes for anyone (human or agent) picking up this project.

## What this is

**Ember** — mobile-first PWA for serious fasting and metabolic health tracking (GKI, autophagy). Not a weight-loss app. v1 is **fully local-only** (IndexedDB, no backend). AWS wiring is deferred to Phase 4+ and will be provisioned via **CDK (TypeScript)**.

Source of truth for scope: [Notion plan](https://www.notion.so/34209f752aab814c8432e993f676452c).

## Commands

Run from `C:\Workplace`.

| Command            | What it does                                    |
| ------------------ | ----------------------------------------------- |
| `npm run dev`      | Vite dev server on http://localhost:5173/       |
| `npm run build`    | Type-check + production build to `dist/`        |
| `npm run preview`  | Serve built `dist/` locally                     |
| `npm run typecheck`| `tsc --noEmit` (no build output)                |

**Windows note:** PowerShell execution policy blocks `npm.ps1`. Call `npm.cmd <script>` instead of `npm <script>` when invoking from a non-interactive shell.

## Stack

- React 18 + Vite 6 + TypeScript (strict)
- Tailwind CSS + CSS variables for theming (dark mode default)
- shadcn/ui conventions (`cn` util, CSS-var tokens) — components added as needed
- Dexie.js (IndexedDB) — offline-first local store
- React Router v6
- vite-plugin-pwa — manifest + service worker
- Framer Motion, Recharts, lucide-react

## Layout

```
src/
├── main.tsx              entry + router mount
├── router.tsx            route table
├── index.css             Tailwind + CSS-var tokens
├── components/
│   ├── AppLayout.tsx     outlet + BottomNav shell
│   └── BottomNav.tsx     4-tab bottom nav
├── routes/
│   ├── Fast.tsx          fasting timer (Phase 1)
│   ├── Log.tsx           glucose/ketones/electrolytes (Phase 2)
│   ├── Charts.tsx        Recharts (Phase 3)
│   └── Settings.tsx      units toggle, GKI targets, theme
├── components/fast/      TimerDisplay, StageIndicator, ProtocolPicker
├── components/log/       GlucoseKetoneForm, ElectrolyteForm, LogHistory, CsvImportButton, TagInput
├── components/charts/    TimeRangeToggle, DigestCard, ChartCard, GkiChart, GlucoseKetoneChart, FastDurationChart
├── hooks/                useActiveFast, useFastHistory, useNow, useMetabolicLogs, useElectrolyteLogs, useSettings, useRecentTags
├── db/
│   ├── index.ts          Dexie instance + DEFAULT_SETTINGS + getSettings()
│   └── types.ts          FastingSession, MetabolicLog, ElectrolyteLog, UserSettings
└── lib/
    ├── utils.ts          cn()
    ├── gki.ts            calculateGki, gkiZone, mmol/mg-dL conversions, autophagyScore
    ├── fasting-stages.ts FASTING_STAGES + getFastingStage(hours)
    ├── electrolytes.ts   ELECTROLYTE_TARGETS (Na/K/Mg/Ca daily ranges)
    ├── csv-import.ts     parseCsv + importMetabolicCsv (pairs glucose/ketone, dedups)
    ├── insights.ts       computeDigest + filterByRange + toGkiSeries/toGlucoseKetoneSeries/toFastBars
    └── tags.ts           normalizeTag, parseTagInput, formatTag, mergeTags
    ├── protocols.ts      PROTOCOLS + getProtocol(key)
    ├── format.ts         formatElapsed/Duration/Date/Time
    ├── streak.ts         calculateStreak(sessions)
    └── notifications.ts  ensureNotificationPermission + scheduleBreakFastReminder
```

Path alias: `@/*` → `src/*`.

## Phase tracker

Check off as phases land. One phase in progress at a time.

- [x] **Phase 0 — Setup & scaffolding**
  - Project scaffold, Tailwind, PWA manifest, bottom nav shell, Dexie schema, GKI/stage libs, Settings route with unit toggle
  - Outstanding: real PWA icons (192/512/maskable PNGs)
- [x] **Phase 1 — Fasting timer**
  - Timer with animated progress ring (Framer Motion), protocol picker (8 presets), live stage indicator, active-fast persistence, history list, streak counter, break-fast notification via Web Notifications API
  - Files: `src/routes/Fast.tsx`, `src/components/fast/*`, `src/hooks/useFasts.ts`, `src/hooks/useNow.ts`, `src/lib/protocols.ts`, `src/lib/format.ts`, `src/lib/streak.ts`, `src/lib/notifications.ts`
- [x] **Phase 2 — Metabolic logging**
  - Tabbed Log route: Glucose/Ketones form (respects unit, live GKI + zone + autophagy score) and Electrolytes form (Na/K/Mg/Ca with daily-target placeholders). Merged log history (descending timestamp) with delete.
  - **CSV import** (Keto-Mojo GK+ style): `#`-comment-tolerant semicolon parser, pairs glucose + ketone rows by `reading_timestamp`, converts mg/dL → mmol/L, dedups on `sourceId` (combined `reading_id`s).
  - **Tags** (schema v3, multi-entry `*tags` index on both log tables): shared `TagInput` with chip UI, inline recent-tag suggestions (top 12 from last 200 rows across both tables). CSV import stores tags in the dedicated `tags` field (no longer appended to notes). Tags render as pills in history.
  - Files: `src/routes/Log.tsx`, `src/components/log/*`, `src/hooks/useLogs.ts`, `src/hooks/useTags.ts`, `src/lib/electrolytes.ts`, `src/lib/csv-import.ts`, `src/lib/tags.ts`, `autophagyScore` added to `src/lib/gki.ts`
- [x] **Phase 3 — Charts & insights**
  - Time-range toggle (7/30/90d). Digest card: avg GKI + trend arrow (improving/worsening/flat, based on first-half vs second-half mean), total fasting hours, longest fast, reading count. GKI line chart with shaded 1–6 optimal band. Glucose + ketones dual-axis line chart (unit-aware). Fasting duration bar chart (ember = hit target, muted = fell short). All offline from IndexedDB.
  - **Tag filter** (OR logic) — click chips to filter metabolic-derived charts + digest. Fasting chart stays unfiltered (fasts have no tags) with an inline hint.
  - Files: `src/routes/Charts.tsx`, `src/components/charts/*`, `src/lib/insights.ts`
  - Not yet: autophagy hours per week, electrolyte compliance chart (punted — less useful until data volume grows)
- [ ] **Phase 4 — Auth & sync (optional for MVP)**
  - Cognito, DynamoDB sync, CSV export. **Provision via CDK.**
- [ ] **Phase 5 — Monetization**
  - Stripe Checkout, freemium limits, paywall
- [ ] **Phase 6 — Polish & launch**
  - Icons, onboarding, dark mode polish, Lighthouse PWA audit, soft launch

## Decisions made

- **Name:** Ember (metabolic-fire metaphor, 2026-04-20)
- **Units:** default mmol/L; user toggle to mg/dL persisted in `userSettings`. Ketones are always mmol/L.
- **v1 data:** local-only via IndexedDB. No backend calls.
- **IaC:** AWS CDK (TypeScript) when we get to Phase 4+. No raw CloudFormation/SAM/Terraform.
- **Hosting target (eventually):** S3 + CloudFront via CodePipeline/CodeBuild.

## Open questions (from Notion)

- [ ] Supplement tracking in v1 or v2?
- [ ] Protein / leucine tracking in v1 or v2?
- [ ] Custom domain — buy now or defer until launch?

## Agent memory

Persistent notes live in `C:\Users\Siqi\.claude\projects\C--Workplace\memory\`. These are auto-loaded into future conversations via `MEMORY.md`.

| File                     | Type     | Purpose                                                   |
| ------------------------ | -------- | --------------------------------------------------------- |
| `project_ember.md`       | project  | What Ember is, stack, v1 approach, units, deploy target   |
| `feedback_iac_cdk.md`    | feedback | Always use CDK (TypeScript) for AWS infra                 |
| `MEMORY.md`              | index    | Pointer list; always loaded                               |

Add to memory when:
- User states a new preference ("always do X", "don't do Y")
- Project-level decisions shift (scope, stack, target)
- External references come up (dashboards, docs, trackers)

Do **not** memorize code paths, phase status, or anything derivable from this file or the repo — keep those here.

## Housekeeping

- Don't commit `dist/`, `node_modules/`, `dev-dist/` — already in `.gitignore`.
- No git repo yet; initialize when the user is ready to push to GitHub (Phase 0 deploy step).
- Before deployment: add real PWA icons, run a Lighthouse audit, confirm `vite build` clean.
