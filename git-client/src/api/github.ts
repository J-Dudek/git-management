import type { ForgePR, ForgeIssue, ForgeRepo } from "../types/forge";

/** GET sur l'API du compte (chemin relatif). La requête et le token sont gérés côté Rust. */
export type ApiGet = <T>(path: string) => Promise<T>;

const seg = (value: string) => encodeURIComponent(value);

// Champs lus dans les réponses de l'API GitHub (le reste est ignoré).
interface RawUser {
  login: string;
}

interface RawLabel {
  name: string;
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
  constructor(private get: ApiGet) {}

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
