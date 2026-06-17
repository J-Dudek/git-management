import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitHubClient } from "./github";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function ok(data: unknown) {
  mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => data, text: async () => "" });
}
function fail(status = 401) {
  mockFetch.mockResolvedValueOnce({ ok: false, status, text: async () => "Unauthorized", json: async () => null });
}

describe("GitHubClient", () => {
  beforeEach(() => mockFetch.mockReset());

  it("getPullRequests maps fields to ForgePR", async () => {
    ok([{
      number: 42, title: "Add feature", state: "open", merged_at: null, draft: false,
      user: { login: "alice", avatar_url: "" }, html_url: "https://github.com/o/r/pull/42",
      created_at: "2024-01-01T00:00:00Z", labels: [{ name: "enhancement" }],
      base: { ref: "main" }, head: { ref: "feature/x" },
    }]);
    const client = new GitHubClient("token");
    const prs = await client.getPullRequests("owner", "repo");

    expect(prs[0].number).toBe(42);
    expect(prs[0].state).toBe("open");
    expect(prs[0].author).toBe("alice");
    expect(prs[0].sourceBranch).toBe("feature/x");
    expect(prs[0].targetBranch).toBe("main");
    expect(prs[0].labels).toEqual(["enhancement"]);
  });

  it("getPullRequests marks merged PRs", async () => {
    ok([{
      number: 1, title: "Merged", state: "closed", merged_at: "2024-01-02T00:00:00Z",
      draft: false, user: { login: "bob" }, html_url: "", created_at: "",
      labels: [], base: { ref: "main" }, head: { ref: "feat" },
    }]);
    const prs = await new GitHubClient("token").getPullRequests("o", "r", "closed");
    expect(prs[0].state).toBe("merged");
  });

  it("getIssues excludes pull requests", async () => {
    ok([
      { number: 1, title: "Bug", state: "open", user: { login: "alice" }, html_url: "", created_at: "", labels: [] },
      { number: 2, title: "PR", state: "open", pull_request: {}, user: { login: "bob" }, html_url: "", created_at: "", labels: [] },
    ]);
    const issues = await new GitHubClient("token").getIssues("o", "r");
    expect(issues).toHaveLength(1);
    expect(issues[0].number).toBe(1);
  });

  it("throws on non-ok response", async () => {
    fail(401);
    await expect(new GitHubClient("bad").getPullRequests("o", "r")).rejects.toThrow("401");
  });

  it("sends Authorization header", async () => {
    ok([]);
    await new GitHubClient("mytoken").getPullRequests("o", "r");
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe("Bearer mytoken");
  });
});
