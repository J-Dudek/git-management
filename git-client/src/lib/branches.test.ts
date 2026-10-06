import { describe, it, expect } from "vitest";
import { localOnlyBranches } from "./branches";
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
