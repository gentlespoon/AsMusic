---
name: organize-plan-files
description: >-
  Sort loose Cursor plan files under `.cursor/plans` into feature
  subdirectories with sortable timestamp prefixes. Use when the user asks
  to organize, tidy, or categorize plan files.
---

1. **Find loose plans only**
   - Targets: `.cursor/plans/*.md` (and `*.plan.md`) at the **root** of `.cursor/plans`.
   - Ignore: subdirectories, `.DS_Store`, non-plan junk.
   - Do not re-sort files already inside a feature subdirectory unless the user asks.

2. **Timestamp prefix**
   - Pattern: `YYYY-MM-DDThh-mm-ss-` (e.g. `2026-07-07T23-49-55-`).
   - If the basename already starts with that pattern, **keep it**.
   - Otherwise prepend from file birth time when available, else mtime (`stat`).
   - Do not use “now” for old files.

3. **Categorize (prefer existing folders)**
   - Known categories today: `media-library`, `player`, `shell-related`, `ui`,
     `equalizer`, `oidc`, `onboarding` (extend only when needed).
   - Choose using **filename + a quick read of the plan title/overview**
     (first ~30 lines). Do not invent a narrow folder when a broader one fits
     (e.g. playlist plans → `media-library`, not `playlist`).
   - Create a new camelCase subdirectory only if nothing existing is a fit.
   - If ambiguous between two categories, pick the broader one and note it in the summary.

4. **Move**
   - Destination: `.cursor/plans/{category}/{timestamp}{rest-of-name}`.
   - Use `git mv` when the file is tracked; otherwise normal `mv`.
   - Never overwrite an existing destination; if collision, stop and report.

5. **Report**
   - List each move (`from` → `to`).
   - List anything skipped or left ambiguous.
