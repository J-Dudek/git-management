import { describe, it, expect, vi } from "vitest";
import { GitHubClient } from "./github";

/** `get` simulé : enregistre les chemins demandés au backend et renvoie `data`. */
function client(data: unknown) {
  const get = vi.fn().mockResolvedValue(data);
  return { gh: new GitHubClient(get as never), get };
}

describe("GitHubClient", () => {
  it("getPullRequests maps fields to ForgePR", async () => {
    const { gh, get } = client([{
      number: 42, title: "Add feature", state: "open", merged_at: null, draft: false,
      user: { login: "alice" }, html_url: "https://github.com/o/r/pull/42",
      created_at: "2024-01-01T00:00:00Z", labels: [{ name: "enhancement" }],
      base: { ref: "main" }, head: { ref: "feature/x" },
    }]);
    const prs = await gh.getPullRequests("owner", "repo");

    expect(get).toHaveBeenCalledWith("/repos/owner/repo/pulls?state=open&per_page=50");
    expect(prs[0]).toMatchObject({ number: 42, state: "open", author: "alice", sourceBranch: "feature/x", targetBranch: "main", labels: ["enhancement"] });
  });

  it("marks merged PRs", async () => {
    const { gh } = client([{ number: 1, title: "t", state: "closed", merged_at: "2024-01-02", labels: [] }]);
    expect((await gh.getPullRequests("o", "r"))[0].state).toBe("merged");
  });

  it("getIssues excludes pull requests", async () => {
    const { gh } = client([
      { number: 1, title: "Bug", state: "open", user: { login: "bob" }, labels: [] },
      { number: 2, title: "PR", state: "open", pull_request: {}, labels: [] },
    ]);
    const issues = await gh.getIssues("o", "r");
    expect(issues).toHaveLength(1);
    expect(issues[0].number).toBe(1);
  });

  it("encodes owner and repo in the path", async () => {
    const { gh, get } = client([]);
    await gh.getIssues("o/../x", "r?y");
    expect(get).toHaveBeenCalledWith("/repos/o%2F..%2Fx/r%3Fy/issues?state=open&per_page=50");
  });

  it("propagates backend errors", async () => {
    const get = vi.fn().mockRejectedValue("Token refusé (401/403)");
    await expect(new GitHubClient(get as never).getPullRequests("o", "r")).rejects.toBe("Token refusé (401/403)");
  });

  it("getCurrentUser returns the login", async () => {
    const { gh, get } = client({ login: "alice" });
    expect(await gh.getCurrentUser()).toBe("alice");
    expect(get).toHaveBeenCalledWith("/user");
  });

  it("listRepos maps clone URLs", async () => {
    const { gh } = client([{ name: "r", full_name: "o/r", clone_url: "https://github.com/o/r.git", ssh_url: "git@github.com:o/r.git", private: true, description: null, updated_at: "2024-01-01" }]);
    const repos = await gh.listRepos();
    expect(repos[0]).toMatchObject({ fullName: "o/r", cloneUrl: "https://github.com/o/r.git", private: true, description: "" });
  });
});
