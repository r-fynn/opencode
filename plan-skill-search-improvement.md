# Plan: Improve TUI Skill Search (dialog-skill / dialog-select)

## Diagnosis

**Root cause**: The `/skills` TUI dialog (`packages/tui/src/component/dialog-skill.tsx`) builds `DialogSelectOption` objects with `{ title, description, category: "Skills" }`. But the fuzzysort search in `dialog-select.tsx:165-170` only indexes `keys: ["title", "category"]`. Since every skill uses `category: "Skills"`, the category field is identical across all entries — providing zero discriminatory power. Result: the search is effectively **name-only**.

## Changes

### 1. `packages/tui/src/ui/dialog-select.tsx`

- Add `content?: string | fuzzysort.Prepared` to the `DialogSelectOption` interface — extra text to match against, never rendered (only `title`, `description`, `details`, and `category` are ever put on screen)
- Add `"content"` to the fuzzysort keys array
- Adjust `scoreFn` to weight: title ×2, best-of(description, content, category) ×1

### 2. `packages/tui/src/component/dialog-skill.tsx`

- Pass `skill.description` through to the option (already wired, just unused by search)
- Pass the skill's **full** `skill.content` as `content`, so the entire body is searchable — not just a slice of it
- The API already delivers the full, untruncated skill body to the client (`Skill.Info.content` is an unbounded string end to end: parsed in `packages/opencode/src/skill/index.ts`, served by the `app.skills` HTTP endpoint, and typed as `content: string` in the generated SDK), so no server/transport changes are needed — only the client-side truncation is removed
- Since fuzzysort's own prepare-cache skips any target over 999 characters (most skill bodies exceed that), call `fuzzysort.prepare(skill.content)` once when building each option (inside the `options` memo, which only recomputes when the skills resource reloads) instead of passing a raw string. fuzzysort detects already-prepared targets and skips re-tokenizing them, so the full body isn't re-scanned from scratch on every keystroke.

## Outcome

- Searching for a term that appears anywhere in a skill's **description or full content** will now surface that skill, even if it doesn't match the **name**
- Title matches are still weighted 2×, so exact name matches rank highest
- No architecture changes, no new dependencies, no plugin work

## Non-goals

- LLM-side matching in `packages/core/src/skill/guidance.ts` — separate problem
- Embedding/vector search — valuable but far larger scope
- The `details` display field — keeping it clean