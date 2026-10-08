import type { CreatedPullRequest, ForgeIssue, ForgePR, ForgeRepo, NewPullRequest, PullRequestOptions } from "../types/forge";
import type { ApiGet, ApiSend } from "./github";

// Champs lus dans les réponses de l'API GitLab (le reste est ignoré).
interface RawUser {
  id?: number;
  username: string;
  name?: string;
  state?: string;
}

interface RawProjectSettings {
  default_branch: string;
  squash_option?: "never" | "always" | "default_on" | "default_off";
  remove_source_branch_after_merge?: boolean;
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
  constructor(private get: ApiGet, private send: ApiSend = () => Promise.reject(new Error("Écriture non disponible"))) {}

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

  async getMergeRequestOptions(project: string): Promise<PullRequestOptions> {
    const id = this.encodeProject(project);
    const [info, members, labels, milestones] = await Promise.all([
      this.get<RawProjectSettings>(`/projects/${id}`),
      this.get<RawUser[]>(`/projects/${id}/members/all?per_page=100`),
      this.get<{ name: string; color: string }[]>(`/projects/${id}/labels?per_page=100`),
      this.get<{ id: number; title: string }[]>(`/projects/${id}/milestones?state=active&per_page=100`),
    ]);
    return {
      defaultBranch: info.default_branch,
      users: members
        .filter((m) => m.state !== "blocked")
        .map((m) => ({ id: m.id ?? 0, username: m.username, name: m.name ?? m.username })),
      labels: labels.map((l) => ({ name: l.name, color: l.color })),
      milestones: milestones.map((m) => ({ id: m.id, title: m.title })),
      squashDefault: info.squash_option === "always" || info.squash_option === "default_on",
      removeSourceBranchDefault: info.remove_source_branch_after_merge ?? false,
    };
  }

  /** Tout passe dans la requête de création ; un brouillon est marqué par le préfixe « Draft: ». */
  async createMergeRequest(project: string, input: NewPullRequest): Promise<CreatedPullRequest> {
    const id = this.encodeProject(project);
    const raw = await this.send<RawMergeRequest>("POST", `/projects/${id}/merge_requests`, {
      source_branch: input.sourceBranch,
      target_branch: input.targetBranch,
      title: input.draft && !/^(draft:|\[draft\]|\(draft\))/i.test(input.title) ? `Draft: ${input.title}` : input.title,
      description: input.description,
      assignee_ids: input.assignees.map((u) => u.id),
      reviewer_ids: input.reviewers.map((u) => u.id),
      labels: input.labels.join(","),
      milestone_id: input.milestone?.id,
      remove_source_branch: input.removeSourceBranch,
      squash: input.squash,
    });
    return { pr: parseMR(raw), warnings: [] };
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
