import type { BranchInfo } from "../types/git";

/** Branches locales jamais publiées : pas de branche suivie, ni de branche du même nom sur un remote. */
export function localOnlyBranches(branches: BranchInfo[]): Set<string> {
  const onRemote = new Set(branches.filter((b) => b.is_remote).map((b) => b.name.slice(b.name.indexOf("/") + 1)));
  return new Set(branches.filter((b) => !b.is_remote && !b.upstream && !onRemote.has(b.name)).map((b) => b.name));
}

export type BranchNode<T> =
  | { kind: "folder"; name: string; path: string; children: BranchNode<T>[]; count: number }
  | { kind: "branch"; name: string; item: T };

/** Range les branches en dossiers selon les « / » de leur nom : feat/a et feat/b vont dans le dossier feat. */
export function branchTree<T>(items: T[], nameOf: (item: T) => string): BranchNode<T>[] {
  const root: BranchNode<T>[] = [];
  for (const item of items) {
    const parts = nameOf(item).split("/");
    let level = root;
    let path = "";
    for (const part of parts.slice(0, -1)) {
      path = path ? `${path}/${part}` : part;
      let folder = level.find((n) => n.kind === "folder" && n.name === part);
      if (!folder) {
        folder = { kind: "folder", name: part, path, children: [], count: 0 };
        level.push(folder);
      }
      if (folder.kind === "folder") {
        folder.count++;
        level = folder.children;
      }
    }
    level.push({ kind: "branch", name: parts[parts.length - 1], item });
  }
  return root;
}

/** Branches dans l'ordre d'affichage de l'arbre. */
export function flattenTree<T>(nodes: BranchNode<T>[]): T[] {
  return nodes.flatMap((n) => (n.kind === "branch" ? [n.item] : flattenTree(n.children)));
}
