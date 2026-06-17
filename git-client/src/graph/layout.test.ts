import { describe, it, expect } from "vitest";
import { computeGraphLayout } from "./layout";
import type { CommitInfo } from "../types/git";

function makeCommit(hash: string, parents: string[]): CommitInfo {
  return {
    hash,
    short_hash: hash.slice(0, 7),
    message: `commit ${hash}`,
    author: "Test",
    email: "test@test.com",
    timestamp: 0,
    parents,
    refs: [],
  };
}

describe("computeGraphLayout", () => {
  it("returns empty layout for empty input", () => {
    const layout = computeGraphLayout([]);
    expect(layout.nodes).toHaveLength(0);
    expect(layout.edges).toHaveLength(0);
    expect(layout.laneCount).toBe(0);
  });

  it("single commit uses lane 0", () => {
    const commits = [makeCommit("aaa", [])];
    const { nodes } = computeGraphLayout(commits);
    expect(nodes[0].lane).toBe(0);
    expect(nodes[0].row).toBe(0);
  });

  it("linear chain stays in lane 0", () => {
    const commits = [
      makeCommit("ccc", ["bbb"]),
      makeCommit("bbb", ["aaa"]),
      makeCommit("aaa", []),
    ];
    const { nodes } = computeGraphLayout(commits);
    expect(nodes.every((n) => n.lane === 0)).toBe(true);
  });

  it("linear chain produces edges between consecutive commits", () => {
    const commits = [
      makeCommit("bbb", ["aaa"]),
      makeCommit("aaa", []),
    ];
    const { edges } = computeGraphLayout(commits);
    expect(edges).toHaveLength(1);
    expect(edges[0].fromRow).toBe(0);
    expect(edges[0].toRow).toBe(1);
  });

  it("merge commit has parent in separate lane", () => {
    const commits = [
      makeCommit("merge", ["main", "feat"]),
      makeCommit("main", []),
      makeCommit("feat", []),
    ];
    const { nodes } = computeGraphLayout(commits);
    const mainNode = nodes.find((n) => n.commit.hash === "main")!;
    const featNode = nodes.find((n) => n.commit.hash === "feat")!;
    expect(mainNode.lane).not.toBe(featNode.lane);
  });

  it("merge commit produces two edges", () => {
    const commits = [
      makeCommit("merge", ["main", "feat"]),
      makeCommit("main", []),
      makeCommit("feat", []),
    ];
    const { edges } = computeGraphLayout(commits);
    expect(edges).toHaveLength(2);
  });

  it("assigns colors to nodes", () => {
    const commits = [makeCommit("aaa", [])];
    const { nodes } = computeGraphLayout(commits);
    expect(nodes[0].color).toMatch(/^#/);
  });

  it("laneCount reflects max lanes used", () => {
    const commits = [
      makeCommit("merge", ["main", "feat"]),
      makeCommit("main", []),
      makeCommit("feat", []),
    ];
    const { laneCount } = computeGraphLayout(commits);
    expect(laneCount).toBeGreaterThanOrEqual(2);
  });
});
