# Plan: Display Total Cost Including Subagents

## Problem

Right panel shows Context cost/tokens for current session only. Subagent (Task tool) costs tracked on separate child sessions — never aggregated into parent display.

## Approach

Lazy query. No backend changes. Use existing `GET /session/{id}/children` SDK endpoint at render time. Sum child costs into total.

## Files to Change

### 1. TUI sidebar — `packages/tui/src/feature-plugins/sidebar/context.tsx`

- Add `createResource` to fetch `api.client.session.children({ sessionID })`
- Compute `totalCost = ownCost + sum(childSessions[].cost)`
- Display additional line: `Total: $X.XX spent`

`api.client` is `OpencodeClient` — available on `TuiPluginApi.client` (line 614 of `packages/plugin/src/tui.ts`).

### 2. Web app context tab — `packages/app/src/components/session/session-context-tab.tsx`

- Add `createResource` to fetch `sdk().client.session.children({ sessionID })` via `useSDK()`
- Compute `totalCost` memo
- Add stat row to `stats` array
- New i18n key: `context.stats.totalCostWithSubagents`

### 3. Web app tooltip — `packages/app/src/components/session-context-usage.tsx`

- Same `createResource` + `totalCost` pattern
- Show additional row in tooltip

### 4. i18n — `packages/app/src/i18n/en.ts`

- Add `"context.stats.totalCostWithSubagents": "Total (incl. subagents)"`
- Other locales: English default fallback works, translate later

## What Stays Same

- `$0.02 spent` line — still shows current session cost
- No backend, DB, projector, or schema changes
- No plugin system changes (already impossible — no cost hooks)

## Verification

- `bun typecheck` from `packages/tui/`
- `bun typecheck` from `packages/app/`