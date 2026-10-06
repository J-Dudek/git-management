import type { BranchInfo } from "../types/git";

/** Branches locales jamais publiées : pas de branche suivie, ni de branche du même nom sur un remote. */
export function localOnlyBranches(branches: BranchInfo[]): Set<string> {
  const onRemote = new Set(branches.filter((b) => b.is_remote).map((b) => b.name.slice(b.name.indexOf("/") + 1)));
  return new Set(branches.filter((b) => !b.is_remote && !b.upstream && !onRemote.has(b.name)).map((b) => b.name));
}
