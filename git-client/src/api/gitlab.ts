import type { ForgePR, ForgeIssue, ForgeRepo } from "../types/forge";
import type { ApiGet } from "./github";

export class GitLabClient {
  constructor(private get: ApiGet) {}

  private encodeProject(project: string): string {
    // Numeric ID passé tel quel, sinon encode le chemin
    if (/^\d+$/.test(project)) return project;
    return encodeURIComponent(project);
  }

  /** Valide le token et renvoie le nom d'utilisateur associé. */
  async getCurrentUser(): Promise<string> {
    const user = await this.get<any>("/user");
    return user.username;
  }

  async listRepos(): Promise<ForgeRepo[]> {
    const data = await this.get<any[]>(
      "/projects?membership=true&per_page=100&order_by=last_activity_at&simple=true"
    );
    return data.map((p) => ({
      name: p.name,
      fullName: p.path_with_namespace,
      cloneUrl: p.http_url_to_repo,
      sshUrl: p.ssh_url_to_repo,
      private: p.visibility !== "public",
      description: p.description ?? "",
      updatedAt: p.last_activity_at,
    }));
  }

  async getMergeRequests(project: string, state: "opened" | "closed" | "merged" | "all" = "opened"): Promise<ForgePR[]> {
    const id = this.encodeProject(project);
    const data = await this.get<any[]>(
      `/projects/${id}/merge_requests?state=${state}&per_page=50`
    );
    return data.map(parseMR);
  }

  async getIssues(project: string, state: "opened" | "closed" | "all" = "opened"): Promise<ForgeIssue[]> {
    const id = this.encodeProject(project);
    const data = await this.get<any[]>(
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
