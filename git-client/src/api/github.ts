import type { ForgePR, ForgeIssue } from "../types/forge";

export class GitHubClient {
  constructor(private token: string) {}

  private async request<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }

  async getPullRequests(owner: string, repo: string, state: "open" | "closed" | "all" = "open"): Promise<ForgePR[]> {
    const data = await this.request<any[]>(
      `https://api.github.com/repos/${owner}/${repo}/pulls?state=${state}&per_page=50`
    );
    return data.map(parsePR);
  }

  async getIssues(owner: string, repo: string, state: "open" | "closed" | "all" = "open"): Promise<ForgeIssue[]> {
    const data = await this.request<any[]>(
      `https://api.github.com/repos/${owner}/${repo}/issues?state=${state}&per_page=50`
    );
    return data.filter((i) => !i.pull_request).map(parseIssue);
  }
}

function parsePR(raw: any): ForgePR {
  return {
    number: raw.number,
    title: raw.title,
    state: raw.merged_at ? "merged" : raw.state,
    author: raw.user?.login ?? "",
    url: raw.html_url,
    createdAt: raw.created_at,
    draft: raw.draft ?? false,
    labels: (raw.labels ?? []).map((l: any) => l.name),
    sourceBranch: raw.head?.ref ?? "",
    targetBranch: raw.base?.ref ?? "",
  };
}

function parseIssue(raw: any): ForgeIssue {
  return {
    number: raw.number,
    title: raw.title,
    state: raw.state,
    author: raw.user?.login ?? "",
    url: raw.html_url,
    createdAt: raw.created_at,
    labels: (raw.labels ?? []).map((l: any) => l.name),
  };
}
