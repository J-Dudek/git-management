#!/usr/bin/env node
// Versionnage automatique à partir des messages de commit (Conventional Commits).
//
//   node scripts/version.mjs next    → affiche la prochaine version (rien si aucune release n'est nécessaire)
//   node scripts/version.mjs apply X.Y.Z → écrit la version dans tous les fichiers applicatifs
//
// Règles : « feat!: » / « BREAKING CHANGE » → majeure ; « feat: » → mineure ;
// « fix: », « perf: », « refactor: », « build: », « revert: » ou message libre → correctif ;
// uniquement « docs: », « ci: », « test: », « chore: », « style: » → pas de release.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const NO_RELEASE = new Set(["docs", "ci", "test", "chore", "style"]);
const RANK = { patch: 1, minor: 2, major: 3 };

/** Type de version imposé par un message de commit (null : aucune release). */
export function bumpForCommit(message) {
  const [header = "", ...body] = message.trim().split("\n");
  if (/^BREAKING[ -]CHANGE:/m.test(body.join("\n"))) return "major";
  const match = header.match(/^(\w+)(\([^)]*\))?(!)?:\s/);
  if (!match) return header.trim() ? "patch" : null;
  const [, type, , bang] = match;
  if (bang) return "major";
  if (type === "feat") return "minor";
  if (NO_RELEASE.has(type)) return null;
  return "patch";
}

/** Le plus fort des types de version demandés par une liste de commits. */
export function bumpForCommits(messages) {
  let best = null;
  for (const message of messages) {
    const bump = bumpForCommit(message);
    if (bump && (!best || RANK[bump] > RANK[best])) best = bump;
  }
  return best;
}

export function incrementVersion(version, bump) {
  const match = version.match(SEMVER);
  if (!match) throw new Error(`Version invalide : ${version}`);
  const [major, minor, patch] = match.slice(1).map(Number);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Type de version inconnu : ${bump}`);
}

/** La plus grande des deux versions. */
export function maxVersion(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] > pb[i] ? a : b;
  return a;
}

/** Remplace la version du paquet `git-client` dans Cargo.toml / Cargo.lock. */
export function setCargoVersion(content, version, { lock = false } = {}) {
  if (lock) {
    const re = /(\[\[package\]\]\nname = "git-client"\nversion = ")[^"]+(")/;
    if (!re.test(content)) throw new Error("Paquet git-client introuvable dans Cargo.lock");
    return content.replace(re, `$1${version}$2`);
  }
  const re = /(\[package\][^[]*?\nversion = ")[^"]+(")/;
  if (!re.test(content)) throw new Error("Version introuvable dans la section [package] de Cargo.toml");
  return content.replace(re, `$1${version}$2`);
}

const files = {
  packageJson: join(ROOT, "package.json"),
  packageLock: join(ROOT, "package-lock.json"),
  cargoToml: join(ROOT, "src-tauri", "Cargo.toml"),
  cargoLock: join(ROOT, "src-tauri", "Cargo.lock"),
  tauriConf: join(ROOT, "src-tauri", "tauri.conf.json"),
};

function updateJson(path, update) {
  const data = JSON.parse(readFileSync(path, "utf8"));
  update(data);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

export function applyVersion(version) {
  if (!SEMVER.test(version)) throw new Error(`Version invalide : ${version}`);
  updateJson(files.packageJson, (d) => (d.version = version));
  updateJson(files.packageLock, (d) => {
    d.version = version;
    if (d.packages?.[""]) d.packages[""].version = version;
  });
  updateJson(files.tauriConf, (d) => (d.version = version));
  writeFileSync(files.cargoToml, setCargoVersion(readFileSync(files.cargoToml, "utf8"), version));
  writeFileSync(files.cargoLock, setCargoVersion(readFileSync(files.cargoLock, "utf8"), version, { lock: true }));
}

function git(...args) {
  // git est cherché dans le PATH du runner de CI (pas de shell, arguments fixes) : chemin absolu impossible à fixer.
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

/** Prochaine version d'après les commits depuis le dernier tag vX.Y.Z (chaîne vide si rien à publier). */
export function nextVersion() {
  let lastTag = "";
  try {
    lastTag = git("describe", "--tags", "--abbrev=0", "--match", "v[0-9]*.[0-9]*.[0-9]*");
  } catch {
    // Aucun tag : tout l'historique compte.
  }
  const range = lastTag ? [`${lastTag}..HEAD`] : ["HEAD"];
  const log = git("log", "--format=%B%x1e", ...range);
  const messages = log.split("\x1e").map((m) => m.trim()).filter(Boolean);
  const bump = bumpForCommits(messages);
  if (!bump) return "";

  const current = JSON.parse(readFileSync(files.packageJson, "utf8")).version;
  const base = lastTag ? maxVersion(lastTag.slice(1), current) : current;
  return incrementVersion(base, bump);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const [command, arg] = process.argv.slice(2);
  if (command === "next") {
    process.stdout.write(nextVersion());
  } else if (command === "apply" && arg) {
    applyVersion(arg);
    process.stdout.write(`Version ${arg} appliquée\n`);
  } else {
    console.error("Usage : node scripts/version.mjs next | apply X.Y.Z");
    process.exit(1);
  }
}
