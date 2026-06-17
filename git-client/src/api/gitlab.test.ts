import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitLabClient } from "./gitlab";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function ok(data: unknown) {
  mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => data, text: async () => "" });
}
function fail(status = 401) {
  mockFetch.mockResolvedValueOnce({ ok: false, status, text: async () => "Unauthorized", json: async () => null });
}

const rawMR = {
  iid: 12,
  title: "Add feature",
  state: "opened",
  draft: false,
  author: { username: "alice" },
  web_url: "https://gitlab.com/owner/repo/-/merge_requests/12",
  created_at: "2024-01-01T00:00:00Z",
  labels: ["backend"],
  source_branch: "feat/x",
  target_branch: "main",
};

const rawIssue = {
  iid: 5,
  title: "Bug report",
  state: "opened",
  author: { username: "bob" },
  web_url: "https://gitlab.com/owner/repo/-/issues/5",
  created_at: "2024-02-01T00:00:00Z",
  labels: ["bug"],
};

describe("GitLabClient", () => {
  beforeEach(() => mockFetch.mockReset());

  it("getMergeRequests maps fields to ForgePR", async () => {
    ok([rawMR]);
    const client = new GitLabClient("token");
    const mrs = await client.getMergeRequests("owner/repo");

    expect(mrs[0].number).toBe(12);
    expect(mrs[0].title).toBe("Add feature");
    expect(mrs[0].state).toBe("open");
    expect(mrs[0].author).toBe("alice");
    expect(mrs[0].sourceBranch).toBe("feat/x");
    expect(mrs[0].targetBranch).toBe("main");
    expect(mrs[0].labels).toEqual(["backend"]);
  });

  it("getMergeRequests maps merged state correctly", async () => {
    ok([{ ...rawMR, state: "merged" }]);
    const client = new GitLabClient("token");
    const mrs = await client.getMergeRequests("owner/repo");
    expect(mrs[0].state).toBe("merged");
  });

  it("getMergeRequests maps closed state correctly", async () => {
    ok([{ ...rawMR, state: "closed" }]);
    const client = new GitLabClient("token");
    const mrs = await client.getMergeRequests("owner/repo");
    expect(mrs[0].state).toBe("closed");
  });

  it("getIssues maps fields to ForgeIssue", async () => {
    ok([rawIssue]);
    const client = new GitLabClient("token");
    const issues = await client.getIssues("owner/repo");

    expect(issues[0].number).toBe(5);
    expect(issues[0].title).toBe("Bug report");
    expect(issues[0].state).toBe("open");
    expect(issues[0].author).toBe("bob");
    expect(issues[0].labels).toEqual(["bug"]);
  });

  it("uses self-hosted base URL", async () => {
    ok([]);
    const client = new GitLabClient("token", "https://gitlab.mycompany.com");
    await client.getMergeRequests("42");
    expect(mockFetch.mock.calls[0][0]).toContain("gitlab.mycompany.com");
  });

  it("encodes path-based project ID", async () => {
    ok([]);
    const client = new GitLabClient("token");
    await client.getMergeRequests("my-org/my-repo");
    expect(mockFetch.mock.calls[0][0]).toContain("my-org%2Fmy-repo");
  });

  it("passes numeric project ID without encoding", async () => {
    ok([]);
    const client = new GitLabClient("token");
    await client.getMergeRequests("12345");
    expect(mockFetch.mock.calls[0][0]).toContain("/projects/12345/");
    expect(mockFetch.mock.calls[0][0]).not.toContain("%");
  });

  it("sends Authorization Bearer header", async () => {
    ok([]);
    const client = new GitLabClient("mytoken");
    await client.getMergeRequests("owner/repo");
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe("Bearer mytoken");
  });

  it("throws on API error", async () => {
    fail(403);
    const client = new GitLabClient("bad");
    await expect(client.getMergeRequests("owner/repo")).rejects.toThrow("403");
  });
});
