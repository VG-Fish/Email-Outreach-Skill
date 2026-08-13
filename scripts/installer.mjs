import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const skillsSource = path.join(packageRoot, "skills");
const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));

/** Marker file written into every installed skill directory so uninstall never removes a directory we did not create. */
const STAMP = ".installed-by-npm.json";

const AGENTS_BEGIN = `<!-- BEGIN ${pkg.name} (managed block — edits inside are overwritten) -->`;
const AGENTS_END = `<!-- END ${pkg.name} -->`;

function frontmatterField(source, field) {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!block) return null;
  const line = new RegExp(`^${field}:[ \\t]*(.+)$`, "m").exec(block[1]);
  return line ? line[1].trim().replace(/^["']|["']$/g, "") : null;
}

/** Every skill shipped in this package, keyed by the `name` its frontmatter declares. */
export function discoverSkills() {
  return fs
    .readdirSync(skillsSource, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = path.join(skillsSource, entry.name);
      const skillFile = path.join(dir, "SKILL.md");
      if (!fs.existsSync(skillFile)) return null;
      const source = fs.readFileSync(skillFile, "utf8");
      return {
        id: frontmatterField(source, "name") || entry.name,
        description: frontmatterField(source, "description") || "",
        dir,
      };
    })
    .filter(Boolean);
}

function codexHome() {
  return process.env.CODEX_HOME
    ? path.resolve(process.env.CODEX_HOME)
    : path.join(os.homedir(), ".codex");
}

/**
 * Where each agent looks for skills. Both Claude Code and Codex CLI read
 * `<root>/skills/<skill-name>/SKILL.md`, so one copy per root serves both.
 */
export function agentRoots(scope, projectDir) {
  if (scope === "global") {
    return [
      { agent: "Claude Code (user)", root: path.join(os.homedir(), ".claude") },
      { agent: "Codex CLI (user)", root: codexHome() },
    ];
  }
  return [
    { agent: "Claude Code (project)", root: path.join(projectDir, ".claude") },
    { agent: "Codex CLI (project)", root: path.join(projectDir, ".codex") },
  ];
}

function readStamp(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, STAMP), "utf8"));
  } catch {
    return null;
  }
}

function installSkill(skill, root, { dryRun, force }) {
  const dest = path.join(root, "skills", skill.id);
  const existing = fs.existsSync(dest);

  if (existing && !readStamp(dest) && !force) {
    return { dest, status: "skipped", reason: "directory exists and was not installed by this package" };
  }
  if (dryRun) return { dest, status: existing ? "would update" : "would install" };

  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(skill.dir, dest, { recursive: true });
  fs.writeFileSync(
    path.join(dest, STAMP),
    `${JSON.stringify({ package: pkg.name, version: pkg.version, installedAt: new Date().toISOString() }, null, 2)}\n`,
  );
  return { dest, status: existing ? "updated" : "installed" };
}

function uninstallSkill(skill, root, { dryRun }) {
  const dest = path.join(root, "skills", skill.id);
  if (!fs.existsSync(dest)) return { dest, status: "absent" };
  if (!readStamp(dest)) {
    return { dest, status: "skipped", reason: "not installed by this package" };
  }
  if (dryRun) return { dest, status: "would remove" };
  fs.rmSync(dest, { recursive: true, force: true });
  return { dest, status: "removed" };
}

/** Pointer block for agents that read AGENTS.md (Codex, Cursor, Copilot, Gemini CLI, Amp, ...) rather than a skills directory. */
function agentsBlock(skills) {
  const body = skills
    .map((skill) => {
      const location = `.claude/skills/${skill.id}/SKILL.md`;
      return `### Skill: ${skill.id}\n\n${skill.description}\n\nWhen that applies, read \`${location}\` in full and follow it before doing the work.`;
    })
    .join("\n\n");
  return `${AGENTS_BEGIN}\n\n${body}\n\n${AGENTS_END}`;
}

function writeAgentsFile(projectDir, skills, { dryRun }) {
  const file = path.join(projectDir, "AGENTS.md");
  const block = agentsBlock(skills);
  const existed = fs.existsSync(file);
  const current = existed ? fs.readFileSync(file, "utf8") : "";

  let next;
  if (current.includes(AGENTS_BEGIN) && current.includes(AGENTS_END)) {
    const start = current.indexOf(AGENTS_BEGIN);
    const end = current.indexOf(AGENTS_END) + AGENTS_END.length;
    next = current.slice(0, start) + block + current.slice(end);
  } else {
    const prefix = current.trim() ? `${current.replace(/\s*$/, "")}\n\n` : "# AGENTS.md\n\n";
    next = `${prefix}${block}\n`;
  }

  if (next === current) return { file, status: "unchanged" };
  if (dryRun) return { file, status: existed ? "would update" : "would create" };
  fs.writeFileSync(file, next);
  return { file, status: existed ? "updated" : "created" };
}

function removeAgentsBlock(projectDir, { dryRun }) {
  const file = path.join(projectDir, "AGENTS.md");
  if (!fs.existsSync(file)) return { file, status: "absent" };
  const current = fs.readFileSync(file, "utf8");
  if (!current.includes(AGENTS_BEGIN) || !current.includes(AGENTS_END)) {
    return { file, status: "absent" };
  }
  if (dryRun) return { file, status: "would update" };
  const start = current.indexOf(AGENTS_BEGIN);
  const end = current.indexOf(AGENTS_END) + AGENTS_END.length;
  const next = `${current.slice(0, start)}${current.slice(end)}`.replace(/\n{3,}/g, "\n\n");
  fs.writeFileSync(file, next.trim() ? next : "");
  return { file, status: "updated" };
}

export function install({ scope, projectDir, agentsMd = true, dryRun = false, force = false }) {
  const skills = discoverSkills();
  const results = [];
  for (const target of agentRoots(scope, projectDir)) {
    for (const skill of skills) {
      results.push({ agent: target.agent, skill: skill.id, ...installSkill(skill, target.root, { dryRun, force }) });
    }
  }
  const agents = scope === "project" && agentsMd ? writeAgentsFile(projectDir, skills, { dryRun }) : null;
  return { scope, projectDir, skills, results, agents };
}

export function uninstall({ scope, projectDir, agentsMd = true, dryRun = false }) {
  const skills = discoverSkills();
  const results = [];
  for (const target of agentRoots(scope, projectDir)) {
    for (const skill of skills) {
      results.push({ agent: target.agent, skill: skill.id, ...uninstallSkill(skill, target.root, { dryRun }) });
    }
  }
  const agents = scope === "project" && agentsMd ? removeAgentsBlock(projectDir, { dryRun }) : null;
  return { scope, projectDir, skills, results, agents };
}

export function status({ projectDir }) {
  const skills = discoverSkills();
  const rows = [];
  for (const scope of ["global", "project"]) {
    for (const target of agentRoots(scope, projectDir)) {
      for (const skill of skills) {
        const dest = path.join(target.root, "skills", skill.id);
        const stamp = readStamp(dest);
        rows.push({
          scope,
          agent: target.agent,
          skill: skill.id,
          dest,
          state: !fs.existsSync(dest) ? "not installed" : stamp ? `installed (v${stamp.version})` : "present (not ours)",
        });
      }
    }
  }
  return rows;
}

export { pkg };
