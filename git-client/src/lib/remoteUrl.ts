import type { RemoteInfo } from "../types/git";
import type { ForgeAccount } from "../types/forge";

export interface ParsedRemote {
  host: string;
  /** Chemin du projet sans `.git` : "owner/repo" ou "group/subgroup/repo". */
  path: string;
}

/** Analyse une URL de remote HTTPS, ssh:// ou scp (`git@host:owner/repo.git`). */
export function parseRemoteUrl(url: string): ParsedRemote | null {
  const trimmed = url.trim();
  const withScheme = trimmed.match(/^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/i);
  const scp = withScheme ? null : trimmed.match(/^(?:[^@/]+@)?([^:/]+):(?!\/\/)(.+)$/);
  const match = withScheme ?? scp;
  if (!match) return null;
  const path = match[2].replace(/\/+$/, "").replace(/\.git$/, "");
  if (!path) return null;
  return { host: match[1].toLowerCase(), path };
}

export function hostOf(baseUrl: string): string | null {
  try {
    return new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Remote du dépôt hébergé sur l'instance du compte (origin en priorité). */
export function remoteForAccount(
  remotes: RemoteInfo[],
  account: ForgeAccount,
): { remote: RemoteInfo; path: string } | null {
  const host = hostOf(account.base_url);
  if (!host) return null;
  const candidates = remotes
    .map((remote) => ({ remote, parsed: parseRemoteUrl(remote.url) }))
    .filter((c) => c.parsed?.host === host)
    .sort((a, b) => Number(b.remote.name === "origin") - Number(a.remote.name === "origin"));
  const first = candidates[0];
  return first ? { remote: first.remote, path: first.parsed!.path } : null;
}

/** Page web de création d'une PR (GitHub) / MR (GitLab) pour une branche. */
export function newPullRequestUrl(account: ForgeAccount, projectPath: string, branch: string): string {
  const base = account.base_url.replace(/\/+$/, "");
  const b = encodeURIComponent(branch);
  return account.provider === "github"
    ? `${base}/${projectPath}/compare/${b}?expand=1`
    : `${base}/${projectPath}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${b}`;
}
