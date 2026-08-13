#!/usr/bin/env node
/**
 * Runs on `npm install`. Copies the skills into the agent directories of whoever
 * installed the package, so the skill is usable without any extra setup step.
 *
 * Deliberately conservative: it never fails the install, never touches files it
 * did not create, and does nothing when the package is not being consumed as a
 * dependency (a checkout of this repo, or CI).
 *
 * Escape hatches:
 *   EMAIL_OUTREACH_SKILL_SKIP_INSTALL=1    do nothing
 *   EMAIL_OUTREACH_SKILL_SCOPE=global|project   override scope detection
 *   EMAIL_OUTREACH_SKILL_NO_AGENTS_MD=1    leave AGENTS.md alone
 *   EMAIL_OUTREACH_SKILL_FORCE_INSTALL=1   run even under CI
 */
import path from "node:path";
import { install, packageRoot, pkg } from "./installer.mjs";

function skipReason() {
  if (process.env.EMAIL_OUTREACH_SKILL_SKIP_INSTALL) return "EMAIL_OUTREACH_SKILL_SKIP_INSTALL is set";
  if (process.env.CI && !process.env.EMAIL_OUTREACH_SKILL_FORCE_INSTALL) return "running under CI";
  if (!packageRoot.split(path.sep).includes("node_modules")) return "running from a source checkout, not an install";
  if (!process.env.INIT_CWD) return "npm did not report an install directory";
  return null;
}

function resolveScope(projectDir) {
  const override = process.env.EMAIL_OUTREACH_SKILL_SCOPE;
  if (override === "global" || override === "project") return override;
  if (process.env.npm_config_global === "true") return "global";
  return path.resolve(projectDir) === path.resolve(packageRoot) ? "global" : "project";
}

try {
  const reason = skipReason();
  if (reason) {
    process.exit(0);
  }

  const projectDir = path.resolve(process.env.INIT_CWD);
  const scope = resolveScope(projectDir);
  const outcome = install({
    scope,
    projectDir,
    agentsMd: !process.env.EMAIL_OUTREACH_SKILL_NO_AGENTS_MD,
  });

  const changed = outcome.results.filter((result) => result.status !== "skipped");
  const skills = [...new Set(changed.map((result) => result.skill))].join(", ");

  if (changed.length) {
    const where = scope === "global" ? "~/.claude and ~/.codex" : `${projectDir} (.claude, .codex)`;
    console.log(`${pkg.name}: installed skill "${skills}" for Claude Code and Codex in ${where}`);
    if (outcome.agents && outcome.agents.status !== "unchanged") {
      console.log(`${pkg.name}: ${outcome.agents.status} ${outcome.agents.file} (managed block)`);
    }
    console.log(`${pkg.name}: run \`npx ${pkg.name} status\` to inspect, \`uninstall\` to remove`);
  }
} catch (error) {
  // A failed convenience step must never break the consumer's install.
  console.warn(`${pkg.name}: skill auto-install skipped (${error.message}). Run \`npx ${pkg.name} install\` to retry.`);
}

process.exit(0);
