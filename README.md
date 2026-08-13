# Email Outreach Skill

An approval-gated outreach workflow for researching a user-defined number of
qualified customers or sponsors, selecting a template direction, tracking
campaign data, and choosing a compliant delivery method.

Installing the package puts the skill where coding agents already look for it,
so there is no manual copy step.

## Install

For every project on your machine:

```bash
npm install -g @vgopal1290/email-outreach-skill
```

For one project only:

```bash
npm install --save-dev @vgopal1290/email-outreach-skill
```

Restart any running agent session afterwards so it re-scans its skills directory.

## What gets written

| Agent | Global install | Project install |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/email-outreach/` | `<project>/.claude/skills/email-outreach/` |
| Codex CLI | `$CODEX_HOME/skills/email-outreach/` (default `~/.codex`) | `<project>/.codex/skills/email-outreach/` |
| Anything reading `AGENTS.md` (Cursor, Copilot, Gemini CLI, Amp, …) | — | a managed block in `<project>/AGENTS.md` pointing at the skill |

Both Claude Code and Codex CLI read the same `SKILL.md` format and load it on
demand, so the skill activates when the conversation matches its description —
outreach, sponsorship, cold email, campaign research — without being invoked by
name. Agents that have no skills directory get a short pointer block in
`AGENTS.md`, delimited by `BEGIN`/`END` markers; content outside those markers is
never modified.

Existing skill directories that this package did not create are left alone
(pass `--force` to overwrite them).

## If the skill did not install itself

Some setups block dependency lifecycle scripts: pnpm and Yarn Berry do by
default, as does `npm install --ignore-scripts`. Run the installer directly:

```bash
npx @vgopal1290/email-outreach-skill install --global   # or: install
```

## CLI

```
npx @vgopal1290/email-outreach-skill <command> [options]

Commands
  install      Copy the skills into the agent directories (default)
  uninstall    Remove skills this package installed
  status       Show where the skills are currently installed
  path         Print this package's skills directory

Options
  --global           Install for the current user
  --project [dir]    Install into a project directory (default: current directory)
  --no-agents-md     Do not touch the project's AGENTS.md
  --force            Overwrite skill directories this package did not install
  --dry-run          Report what would change without writing
```

With no scope flag, a directory containing `package.json` or `.git` is treated as
a project; otherwise the install is global.

## Automatic install behaviour

The `postinstall` step is deliberately conservative. It does nothing when the
package is running from a source checkout rather than an install, when `CI` is
set, or when npm reports no install directory — and a failure there prints a
warning instead of breaking your install.

| Variable | Effect |
| --- | --- |
| `EMAIL_OUTREACH_SKILL_SKIP_INSTALL=1` | Skip the automatic install entirely |
| `EMAIL_OUTREACH_SKILL_SCOPE=global\|project` | Override scope detection |
| `EMAIL_OUTREACH_SKILL_NO_AGENTS_MD=1` | Leave `AGENTS.md` alone |
| `EMAIL_OUTREACH_SKILL_FORCE_INSTALL=1` | Run even under CI |

## Uninstall

```bash
npx @vgopal1290/email-outreach-skill uninstall --global   # or: uninstall
npm uninstall -g @vgopal1290/email-outreach-skill
```

Uninstall removes only directories carrying this package's install marker, and
strips its managed block out of `AGENTS.md`.

## Contents

- `skills/vg_stack-email-outreach/SKILL.md` — the skill instructions
- `bin/email-outreach-skill.mjs` — installer CLI
- `scripts/installer.mjs`, `scripts/postinstall.mjs` — install logic
