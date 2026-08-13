#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { agentRoots, install, packageRoot, pkg, status, uninstall } from "../scripts/installer.mjs";

const USAGE = `${pkg.name} v${pkg.version}

Installs this package's skills where coding agents look for them:
  Claude Code   <root>/.claude/skills/<skill>/SKILL.md
  Codex CLI     <root>/.codex/skills/<skill>/SKILL.md
  other agents  a managed pointer block in the project's AGENTS.md

Usage
  npx ${pkg.name} [command] [options]

Commands
  install      Copy the skills into the agent directories (default)
  uninstall    Remove skills this package installed
  status       Show where the skills are currently installed
  path         Print this package's skills directory

Options
  --global           Install for the current user (~/.claude, ~/.codex or $CODEX_HOME)
  --project [dir]    Install into a project directory (default: current directory)
  --no-agents-md     Do not touch the project's AGENTS.md
  --force            Overwrite skill directories this package did not install
  --dry-run          Report what would change without writing
  -h, --help         Show this help

With no scope flag, a directory containing package.json or .git is treated as
a project; otherwise the install is global.`;

function parseArgs(argv) {
  const options = { command: "install", scope: null, projectDir: null, agentsMd: true, dryRun: false, force: false };
  const rest = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") return { ...options, command: "help" };
    else if (arg === "--global") options.scope = "global";
    else if (arg === "--project") {
      options.scope = "project";
      if (argv[i + 1] && !argv[i + 1].startsWith("-")) options.projectDir = path.resolve(argv[++i]);
    } else if (arg === "--no-agents-md") options.agentsMd = false;
    else if (arg === "--agents-md") options.agentsMd = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--force") options.force = true;
    else if (arg.startsWith("-")) throw new Error(`unknown option: ${arg}`);
    else rest.push(arg);
  }

  if (rest.length > 1) throw new Error(`unexpected arguments: ${rest.slice(1).join(" ")}`);
  if (rest[0]) options.command = rest[0];

  options.projectDir = options.projectDir || process.cwd();
  options.scope = options.scope || (looksLikeProject(options.projectDir) ? "project" : "global");
  return options;
}

function looksLikeProject(dir) {
  return fs.existsSync(path.join(dir, "package.json")) || fs.existsSync(path.join(dir, ".git"));
}

function report(outcome) {
  const scopeLabel = outcome.scope === "global" ? "user" : outcome.projectDir;
  console.log(`Scope: ${outcome.scope} (${scopeLabel})`);
  for (const result of outcome.results) {
    const suffix = result.reason ? ` — ${result.reason}` : "";
    console.log(`  ${result.status.padEnd(12)} ${result.skill}  ${result.dest}${suffix}`);
  }
  if (outcome.agents) {
    console.log(`  ${outcome.agents.status.padEnd(12)} AGENTS.md  ${outcome.agents.file}`);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  switch (options.command) {
    case "help":
      console.log(USAGE);
      return;
    case "path":
      console.log(path.join(packageRoot, "skills"));
      return;
    case "status": {
      for (const row of status({ projectDir: options.projectDir })) {
        console.log(`${row.scope.padEnd(8)} ${row.skill.padEnd(16)} ${row.state.padEnd(20)} ${row.dest}`);
      }
      return;
    }
    case "install": {
      report(install(options));
      if (!options.dryRun) {
        const roots = agentRoots(options.scope, options.projectDir).map((target) => target.agent);
        console.log(`\nReady in: ${roots.join(", ")}. Restart a running agent session to pick the skill up.`);
      }
      return;
    }
    case "uninstall":
      report(uninstall(options));
      return;
    default:
      throw new Error(`unknown command: ${options.command}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`${pkg.name}: ${error.message}\n`);
  console.error(USAGE);
  process.exit(1);
}
