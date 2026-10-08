import { describe, it, expect, vi } from "vitest";
import { GitLabClient } from "./gitlab";

function client(data: unknown) {
  const get = vi.fn().mockResolvedValue(data);
  return { gl: new GitLabClient(get as never), get };
}

const rawMR = {
  iid: 12, title: "Add feature", state: "opened", draft: false, author: { username: "alice" },
  web_url: "https://gitlab.com/owner/repo/-/merge_requests/12", created_at: "2024-01-01T00:00:00Z",
  labels: ["backend"], source_branch: "feat/x", target_branch: "main",
};

describe("GitLabClient", () => {
  it("getMergeRequests maps fields to ForgePR", async () => {
    const { gl } = client([rawMR]);
    const [mr] = await gl.getMergeRequests("owner/repo");
    expect(mr).toMatchObject({ number: 12, state: "open", author: "alice", sourceBranch: "feat/x", targetBranch: "main", labels: ["backend"] });
  });

  it("maps merged and closed states", async () => {
    const { gl } = client([{ ...rawMR, state: "merged" }, { ...rawMR, iid: 13, state: "closed" }]);
    const mrs = await gl.getMergeRequests("owner/repo");
    expect(mrs.map((m) => m.state)).toEqual(["merged", "closed"]);
  });

  it("getIssues maps fields to ForgeIssue", async () => {
    const { gl } = client([{ iid: 5, title: "Bug", state: "opened", author: { username: "bob" }, web_url: "u", created_at: "d", labels: ["bug"] }]);
    const [issue] = await gl.getIssues("owner/repo");
    expect(issue).toMatchObject({ number: 5, state: "open", author: "bob", labels: ["bug"] });
  });

  it("encodes path-based project IDs", async () => {
    const { gl, get } = client([]);
    await gl.getMergeRequests("group/sub/repo");
    expect(get).toHaveBeenCalledWith("/projects/group%2Fsub%2Frepo/merge_requests?state=opened&per_page=50");
  });

  it("passes numeric project IDs without encoding", async () => {
    const { gl, get } = client([]);
    await gl.getIssues("42");
    expect(get).toHaveBeenCalledWith("/projects/42/issues?state=opened&per_page=50");
  });

  it("getCurrentUser hits /user", async () => {
    const { gl, get } = client({ username: "carol" });
    expect(await gl.getCurrentUser()).toBe("carol");
    expect(get).toHaveBeenCalledWith("/user");
  });

  it("listRepos maps projects", async () => {
    const { gl } = client([{ name: "app", path_with_namespace: "team/app", http_url_to_repo: "https://gitlab.com/team/app.git", ssh_url_to_repo: "git@gitlab.com:team/app.git", visibility: "private", description: "d", last_activity_at: "2024-01-01" }]);
    const [repo] = await gl.listRepos();
    expect(repo).toMatchObject({ fullName: "team/app", cloneUrl: "https://gitlab.com/team/app.git", private: true });
  });
});

describe("GitLabClient merge request creation", () => {
  it("sends every option in the creation request, draft as a title prefix", async () => {
    const send = vi.fn().mockResolvedValue(rawMR);
    const gl = new GitLabClient(vi.fn() as never, send as never);
    const { pr } = await gl.createMergeRequest("group/app", {
      sourceBranch: "feat/x", targetBranch: "main", title: "feat: x", description: "d", draft: true,
      assignees: [{ id: 1, username: "alice", name: "Alice" }], reviewers: [{ id: 2, username: "bob", name: "Bob" }],
      labels: ["a", "b"], milestone: { id: 9, title: "v2" }, removeSourceBranch: true, squash: false,
    });
    expect(send).toHaveBeenCalledWith("POST", "/projects/group%2Fapp/merge_requests", {
      source_branch: "feat/x", target_branch: "main", title: "Draft: feat: x", description: "d",
      assignee_ids: [1], reviewer_ids: [2], labels: "a,b", milestone_id: 9, remove_source_branch: true, squash: false,
    });
    expect(pr.number).toBe(12);
  });

  it("reads project defaults for squash and source branch removal", async () => {
    const responses: Record<string, unknown> = {
      "/projects/group%2Fapp": { default_branch: "develop", squash_option: "default_on", remove_source_branch_after_merge: true },
      "/projects/group%2Fapp/members/all?per_page=100": [{ id: 1, username: "alice", name: "Alice" }, { id: 2, username: "old", state: "blocked" }],
      "/projects/group%2Fapp/labels?per_page=100": [{ name: "bug", color: "#ff0000" }],
      "/projects/group%2Fapp/milestones?state=active&per_page=100": [{ id: 4, title: "v2" }],
    };
    const get = vi.fn((path: string) => Promise.resolve(responses[path]));
    const options = await new GitLabClient(get as never).getMergeRequestOptions("group/app");
    expect(options).toEqual({
      defaultBranch: "develop",
      users: [{ id: 1, username: "alice", name: "Alice" }],
      labels: [{ name: "bug", color: "#ff0000" }],
      milestones: [{ id: 4, title: "v2" }],
      squashDefault: true,
      removeSourceBranchDefault: true,
    });
  });
});
