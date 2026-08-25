# docs/

Human-facing project documentation — architecture decisions, runbooks, onboarding notes.

This is distinct from `.claude/rules/`, which holds agent-facing conventions that Claude Code
loads automatically (and only) when relevant files are touched. If something belongs in both
places, write it once in `docs/` and reference it briefly from the relevant `.claude/rules/*.md`
or from `CLAUDE.md` — don't duplicate it.
