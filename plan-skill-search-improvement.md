# Plan: Improve TUI Skill Search (dialog-skill / dialog-select)

## Diagnosis

**Root cause**: The `/skills` TUI dialog (`packages/tui/src/component/dialog-skill.tsx`) builds `DialogSelectOption` objects with `{ title, description, category: "Skills" }`. But the fuzzysort search in `dialog-select.tsx:165-170` only indexes `keys: ["title", "category"]`. Since every skill uses `category: "Skills"`, the category field is identical across all entries — providing zero discriminatory power. Result: the search is effectively **name-only**.

## Changes

### 1. `packages/tui/src/ui/dialog-select.tsx`

- Add `searchText?: string` to the `DialogSelectOption` interface
- Add `"searchText"` to the fuzzysort keys array
- Adjust `scoreFn` to weight: title ×2, best-of(description, searchText, category) ×1

### 2. `packages/tui/src/component/dialog-skill.tsx`

- Pass `skill.description` through to the option (already wired, just unused by search)
- Pass `skill.content?.slice(0, 500)` as `searchText` so skill body content is indexed

## Outcome

- Searching for a term that appears in a skill's **description or first 500 chars of content** will now surface that skill, even if it doesn't match the **name**
- Title matches are still weighted 2×, so exact name matches rank highest
- No architecture changes, no new dependencies, no plugin work

## Non-goals

- LLM-side matching in `packages/core/src/skill/guidance.ts` — separate problem
- Embedding/vector search — valuable but far larger scope
- The `details` display field — keeping it clean