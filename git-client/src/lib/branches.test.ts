import { describe, it, expect } from "vitest";
import { branchTree, flattenTree, localOnlyBranches } from "./branches";
import type { BranchInfo } from "../types/git";

const branch = (name: string, extra: Partial<BranchInfo> = {}): BranchInfo => ({
  name, is_remote: false, target_hash: "0", is_head: false, upstream: null, ahead: 0, behind: 0, ...extra,
});

describe("localOnlyBranches", () => {
  it("keeps only branches absent from every remote", () => {
    const result = localOnlyBranches([
      branch("main", { upstream: "origin/main" }),
      branch("feat/x"), // pas suivie, mais présente sur origin
      branch("essai"),
      branch("origin/main", { is_remote: true }),
      branch("origin/feat/x", { is_remote: true }),
    ]);
    expect([...result]).toEqual(["essai"]);
  });
});

describe("branchTree", () => {
  it("groups branches into folders by slash", () => {
    const tree = branchTree(["feat/design", "feat/test", "fix/login", "fix/ui/menu", "main"], (n) => n);
    expect(tree.map((n) => [n.kind, n.name])).toEqual([["folder", "feat"], ["folder", "fix"], ["branch", "main"]]);
    const fix = tree[1];
    expect(fix.kind === "folder" && fix.count).toBe(2);
    expect(fix.kind === "folder" && fix.children.map((n) => n.name)).toEqual(["login", "ui"]);
    const ui = fix.kind === "folder" ? fix.children[1] : null;
    expect(ui?.kind === "folder" && ui.path).toBe("fix/ui");
    expect(flattenTree(tree)).toEqual(["feat/design", "feat/test", "fix/login", "fix/ui/menu", "main"]);
  });
});
