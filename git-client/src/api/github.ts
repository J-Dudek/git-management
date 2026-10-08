import type {
  CreatedPullRequest, ForgeIssue, ForgeLabel, ForgeMilestone, ForgePR, ForgeRepo, ForgeUser, NewPullRequest, PullRequestOptions,
} from "../types/forge";
import { errorMessage } from "../lib/actions";

/** GET sur l'API du compte (chemin relatif). La requête et le token sont gérés côté Rust. */
export type ApiGet = <T>(path: string) => Promise<T>;
/** Requête d'écriture sur l'API du compte, avec corps JSON. */
export type ApiSend = <T>(method: "POST" | "PUT" | "PATCH", path: string, body: unknown) => Promise<T>;

const noSend: ApiSend = () => Promise.reject(new Error("Écriture non disponible"));

const seg = (value: string) => encodeURIComponent(value);

// Champs lus dans les réponses de l'API GitHub (le reste est ignoré).
interface RawUser {
  id?: number;
  login: string;
}

interface RawLabel {
  name: string;
  color?: string;
}

interface RawMilestone {
  number: number;
  title: string;
}

interface RawRepo {
  name: string;
  full_name: string;
  clone_url: string;
  ssh_url: string;
  private: boolean;
  description: string | null;
  updated_at: string;
}

interface RawIssue {
  number: number;
  title: string;
  state: "open" | "closed";
  user: RawUser | null;
  html_url: string;
  created_at: string;
  labels?: RawLabel[];
  /** Présent quand l'« issue » est en fait une pull request. */
  pull_request?: unknown;
}

interface RawPullRequest extends RawIssue {
  merged_at: string | null;
  draft?: boolean;
  head?: { ref: string };
  base?: { ref: string };
}

export class GitHubClient {
  constructor(private get: ApiGet, private send: ApiSend = noSend) {}

  /** Valide le token et renvoie le login associé. */
  async getCurrentUser(): Promise<string> {
    const user = await this.get<RawUser>("/user");
    return user.login;
  }

  async listRepos(): Promise<ForgeRepo[]> {
    const data = await this.get<RawRepo[]>(
      "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member"
    );
    return data.map((r) => ({
      name: r.name,
      fullName: r.full_name,
      cloneUrl: r.clone_url,
      sshUrl: r.ssh_url,
      private: r.private,
      description: r.description ?? "",
      updatedAt: r.updated_at,
    }));
  }

  async getPullRequests(owner: string, repo: string, state: "open" | "closed" | "all" = "open"): Promise<ForgePR[]> {
    const data = await this.get<RawPullRequest[]>(`/repos/${seg(owner)}/${seg(repo)}/pulls?state=${state}&per_page=50`);
    return data.map(parsePR);
  }

  async getIssues(owner: string, repo: string, state: "open" | "closed" | "all" = "open"): Promise<ForgeIssue[]> {
    const data = await this.get<RawIssue[]>(`/repos/${seg(owner)}/${seg(repo)}/issues?state=${state}&per_page=50`);
    return data.filter((i) => !i.pull_request).map(parseIssue);
  }

  async getPullRequestOptions(owner: string, repo: string): Promise<PullRequestOptions> {
    const base = `/repos/${seg(owner)}/${seg(repo)}`;
    const [info, users, labels, milestones] = await Promise.all([
      this.get<{ default_branch: string }>(base),
      this.get<RawUser[]>(`${base}/assignees?per_page=100`),
      this.get<RawLabel[]>(`${base}/labels?per_page=100`),
      this.get<RawMilestone[]>(`${base}/milestones?state=open&per_page=100`),
    ]);
    return {
      defaultBranch: info.default_branch,
      users: users.map((u): ForgeUser => ({ id: u.id ?? 0, username: u.login, name: u.login })),
      labels: labels.map((l): ForgeLabel => ({ name: l.name, color: `#${l.color ?? "888888"}` })),
      milestones: milestones.map((m): ForgeMilestone => ({ id: m.number, title: m.title })),
      squashDefault: false,
      removeSourceBranchDefault: false,
    };
  }

  /**
   * Crée la PR, puis demande les relecteurs et pose assignés / labels / jalon (API des issues).
   * Ces étapes secondaires n'annulent pas la création si elles échouent.
   */
  async createPullRequest(owner: string, repo: string, input: NewPullRequest): Promise<CreatedPullRequest> {
    const base = `/repos/${seg(owner)}/${seg(repo)}`;
    const raw = await this.send<RawPullRequest>("POST", `${base}/pulls`, {
      title: input.title,
      body: input.description,
      head: input.sourceBranch,
      base: input.targetBranch,
      draft: input.draft,
    });
    const warnings: string[] = [];
    if (input.reviewers.length) {
      await this.send("POST", `${base}/pulls/${raw.number}/requested_reviewers`, {
        reviewers: input.reviewers.map((u) => u.username),
      }).catch((e) => warnings.push(`relecteurs : ${errorMessage(e)}`));
    }
    if (input.assignees.length || input.labels.length || input.milestone) {
      const patch: Record<string, unknown> = {};
      if (input.assignees.length) patch.assignees = input.assignees.map((u) => u.username);
      if (input.labels.length) patch.labels = input.labels;
      if (input.milestone) patch.milestone = input.milestone.id;
      await this.send("PATCH", `${base}/issues/${raw.number}`, patch)
        .catch((e) => warnings.push(`assignés / labels / jalon : ${errorMessage(e)}`));
    }
    return { pr: parsePR(raw), warnings };
  }
}

function parsePR(raw: RawPullRequest): ForgePR {
  return {
    number: raw.number,
    title: raw.title,
    state: raw.merged_at ? "merged" : raw.state,
    author: raw.user?.login ?? "",
    url: raw.html_url,
    createdAt: raw.created_at,
    draft: raw.draft ?? false,
    labels: (raw.labels ?? []).map((l) => l.name),
    sourceBranch: raw.head?.ref ?? "",
    targetBranch: raw.base?.ref ?? "",
  };
}

function parseIssue(raw: RawIssue): ForgeIssue {
  return {
    number: raw.number,
    title: raw.title,
    state: raw.state,
    author: raw.user?.login ?? "",
    url: raw.html_url,
    createdAt: raw.created_at,
    labels: (raw.labels ?? []).map((l) => l.name),
  };
}
