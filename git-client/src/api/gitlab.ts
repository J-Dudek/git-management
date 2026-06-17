import type { ForgePR, ForgeIssue } from "../types/forge";

export class GitLabClient {
  private apiBase: string;

  constructor(private token: string, baseUrl = "https://gitlab.com") {
    this.apiBase = `${baseUrl.replace(/\/$/, "")}/api/v4`;
  }

  private async request<T>(path: string): Promise<T> {
    const res = await fetch(`${this.apiBase}${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`GitLab API ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }

  private encodeProject(project: string): string {
    // Numeric ID passé tel quel, sinon encode le chemin
    if (/^\d+$/.test(project)) return project;
    return encodeURIComponent(project);
  }

  async getMergeRequests(project: string, state: "opened" | "closed" | "merged" | "all" = "opened"): Promise<ForgePR[]> {
    const id = this.encodeProject(project);
    const data = await this.request<any[]>(
      `/projects/${id}/merge_requests?state=${state}&per_page=50`
    );
    return data.map(parseMR);
  }

  async getIssues(project: string, state: "opened" | "closed" | "all" = "opened"): Promise<ForgeIssue[]> {
    const id = this.encodeProject(project);
    const data = await this.request<any[]>(
      `/projects/${id}/issues?state=${state}&per_page=50`
    );
    return data.map(parseIssue);
  }
}

function parseMR(raw: any): ForgePR {
  return {
    number: raw.iid,
    title: raw.title,
    state: raw.state === "opened" ? "open" : raw.state === "merged" ? "merged" : "closed",
    author: raw.author?.username ?? "",
    url: raw.web_url,
    createdAt: raw.created_at,
    draft: raw.draft ?? false,
    labels: raw.labels ?? [],
    sourceBranch: raw.source_branch ?? "",
    targetBranch: raw.target_branch ?? "",
  };
}

function parseIssue(raw: any): ForgeIssue {
  return {
    number: raw.iid,
    title: raw.title,
    state: raw.state === "opened" ? "open" : "closed",
    author: raw.author?.username ?? "",
    url: raw.web_url,
    createdAt: raw.created_at,
    labels: raw.labels ?? [],
  };
}
