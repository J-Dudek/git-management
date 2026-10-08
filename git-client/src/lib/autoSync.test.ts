import { describe, expect, it } from "vitest";
import { describeChanges, pullRequestChanges, remoteBranchChanges } from "./autoSync";
import type { ForgePR } from "../types/forge";
import type { BranchInfo } from "../types/git";

const branch = (name: string, hash: string, is_remote = true): BranchInfo => ({
  name, is_remote, target_hash: hash, is_head: false, upstream: null, ahead: 0, behind: 0,
});

const pr = (number: number, title = `PR ${number}`) => ({ number, title }) as ForgePR;

describe("remoteBranchChanges", () => {
  it("détecte les branches distantes nouvelles, déplacées et supprimées", () => {
    const before = [branch("origin/main", "a"), branch("origin/old", "b"), branch("origin/HEAD", "a"), branch("main", "a", false)];
    const after = [branch("origin/main", "c"), branch("origin/feat", "d"), branch("origin/HEAD", "c"), branch("main", "z", false)];
    expect(remoteBranchChanges(before, after)).toEqual({
      newBranches: ["origin/feat"],
      updatedBranches: ["origin/main"],
      deletedBranches: ["origin/old"],
    });
  });
});

describe("pullRequestChanges", () => {
  it("ne signale rien au premier chargement", () => {
    expect(pullRequestChanges(null, [pr(1)])).toEqual({ openedPrs: [], closedPrs: [] });
  });

  it("détecte les PR ouvertes et fermées", () => {
    expect(pullRequestChanges([pr(1), pr(2)], [pr(2), pr(3)])).toEqual({ openedPrs: [pr(3)], closedPrs: [pr(1)] });
  });
});

describe("describeChanges", () => {
  const none = { newBranches: [], updatedBranches: [], deletedBranches: [], openedPrs: [], closedPrs: [] };

  it("renvoie null sans changement", () => {
    expect(describeChanges("repo", none)).toBeNull();
  });

  it("résume les changements", () => {
    expect(describeChanges("repo", { ...none, updatedBranches: ["origin/main", "origin/dev"], openedPrs: [pr(4, "Fix")] }, "MR"))
      .toBe("repo : 2 branches mises à jour (origin/main, origin/dev) · MR #4 ouverte « Fix »");
  });
});
