# Project instructions for Claude Code

<!--
  SETUP: delete whichever stack block below doesn't apply to this repo, and verify every
  command against this repo's actual package.json / Makefile / pyproject.toml. Delete this
  comment block once done.
-->

## Project overview

<!-- One paragraph: what this repo does, key entry points. Don't restate directory structure —
     Claude can see that itself; only note things that aren't obvious from the code. -->

## Commands

These are the real, verified commands for this repo. Don't guess alternatives (`yarn` vs `npm` vs `pnpm` etc.) — if a command below is wrong or missing, fix this section or prompt the user to fix it rather than trying variations.

### Node / TypeScript (npm or yarn — delete this block if not applicable)

| Task               | Command                                   |
| ------------------ | ----------------------------------------- |
| Lint               | `npm run lint -- --quiet`                 |
| Lint — single file | `npm run lint -- path/to/file.ts --quiet` |

<!-- | Test — all         | `npm test -- --silent` _(if not Jest: Vitest `--reporter=dot`, Mocha `--reporter=dot`)_ | -->
<!-- | Test — single file | `npm test -- path/to/file.test.ts --silent`                                             | -->
<!-- | Test — single case | `npm test -- -t "test name" --silent`                                                   | -->
<!-- | Typecheck          | `npx tsc --noEmit --pretty false`                                                       | -->
<!-- | Format             | `npm run format -- --log-level warn`                                                    | -->

_If a quiet run fails or the output is unhelpfully sparse, drop the flag for that one invocation and re-run — quiet is the default, not a hard rule._

## Conventions

- `.claude/rules/` holds deeper, path-scoped conventions that load automatically only when
  Claude touches matching files (keeps them out of every session's base context).
- `docs/` holds human-facing project docs (architecture, runbooks). Not auto-loaded by Claude.

## Read-only commands

`git status`, `git diff`, `git log`, `ls`, `cat`, `head`, `tail`, `grep`, `find` and similar are
already permitted by Claude Code by default — no permission rule needed for these. Only
test/lint/typecheck/format commands are pre-approved in `.claude/settings.json`; anything that
installs, pushes, or mutates state will still prompt.
