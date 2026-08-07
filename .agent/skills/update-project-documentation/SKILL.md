---
name: update-project-documentation
description: >-
  Keep detailed per-feature docs under doc/features/ so future agents can
  work without re-exploring the codebase. Use when the user asks to update,
  refresh, or write feature/module documentation.
---

1. **Scope**
   - If the user names a feature (and optional exclusions), document only that.
   - If none named, list existing `doc/features/*.md` and obvious undocumented areas; ask which to do, or update the most stale ones — do not boil the ocean in one pass.

2. **Discover truth (code first)**
   - Explore implementations: core types/mutations, UI, storage, sync, navigation.
   - Cross-check `NOTE.md` and relevant `.cursor/plans/**` for product intent.
   - Prefer **code** over existing docs when they conflict. Treat old `doc/features/*.md` as a draft to correct, not as authority.

3. **Write or update** `/doc/features/{featureName}.md` (singular camelCase file, e.g. `playlist.md`)
   - Prefer **one file per feature**. Split only if the doc becomes unwieldy.
   - Include at least:
     - One-line purpose + explicit **out of scope**
     - Mental model / capability matrix (what exists vs gaps)
     - Architecture (short mermaid when multi-layer)
     - Types, sync/persistence, mutations, UI entry points, deep links
     - Multi-library / multi-server rules if relevant
     - Key files table with roles
     - Known edge cases / dead code / unused APIs
   - Do **not** invent planned work as shipped; mark gaps clearly.

4. **Finish**
   - If an existing doc was refreshed, briefly note what was corrected (stale claims).
   - Leave product notes in `NOTE.md` as short pointers; put detail in `doc/features/`.
