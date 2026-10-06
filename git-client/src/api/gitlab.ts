import type { ForgePR, ForgeIssue, ForgeRepo } from "../types/forge";
import type { ApiGet } from "./github";

// Champs lus dans les réponses de l'API GitLab (le reste est ignoré).
interface RawUser {
  username: string;
}

interface RawProject {
  name: string;
  path_with_namespace: string;
  http_url_to_repo: string;
  ssh_url_to_repo: string;
  visibility: "public" | "internal" | "private";
  description: string | null;
  last_activity_at: string;
}

interface RawIssue {
  iid: number;
  title: string;
  state: "opened" | "closed";
  author: RawUser | null;
  web_url: string;
  created_at: string;
  labels?: string[];
}

interface RawMergeRequest extends Omit<RawIssue, "state"> {
  state: "opened" | "closed" | "merged" | "locked";
  draft?: boolean;
  source_branch?: string;
  target_branch?: string;
}

const MR_STATES: Record<RawMergeRequest["state"], ForgePR["state"]> = {
  opened: "open",
  merged: "merged",
  closed: "closed",
  locked: "closed",
};

export class GitLabClient {
  constructor(private get: ApiGet) {}

  private encodeProject(project: string): string {
    // Numeric ID passé tel quel, sinon encode le chemin
    if (/^\d+$/.test(project)) return project;
    return encodeURIComponent(project);
  }

  /** Valide le token et renvoie le nom d'utilisateur associé. */
  async getCurrentUser(): Promise<string> {
    const user = await this.get<RawUser>("/user");
    return user.username;
  }

  async listRepos(): Promise<ForgeRepo[]> {
    const data = await this.get<RawProject[]>(
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
    const data = await this.get<RawMergeRequest[]>(
      `/projects/${id}/merge_requests?state=${state}&per_page=50`
    );
    return data.map(parseMR);
  }

  async getIssues(project: string, state: "opened" | "closed" | "all" = "opened"): Promise<ForgeIssue[]> {
    const id = this.encodeProject(project);
    const data = await this.get<RawIssue[]>(
      `/projects/${id}/issues?state=${state}&per_page=50`
    );
    return data.map(parseIssue);
  }
}

function parseMR(raw: RawMergeRequest): ForgePR {
  return {
    number: raw.iid,
    title: raw.title,
    state: MR_STATES[raw.state] ?? "closed",
    author: raw.author?.username ?? "",
    url: raw.web_url,
    createdAt: raw.created_at,
    draft: raw.draft ?? false,
    labels: raw.labels ?? [],
    sourceBranch: raw.source_branch ?? "",
    targetBranch: raw.target_branch ?? "",
  };
}

function parseIssue(raw: RawIssue): ForgeIssue {
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
