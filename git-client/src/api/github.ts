import type { ForgePR, ForgeIssue, ForgeRepo } from "../types/forge";

/** GET sur l'API du compte (chemin relatif). La requête et le token sont gérés côté Rust. */
export type ApiGet = <T>(path: string) => Promise<T>;

const seg = (value: string) => encodeURIComponent(value);

export class GitHubClient {
  constructor(private get: ApiGet) {}

  /** Valide le token et renvoie le login associé. */
  async getCurrentUser(): Promise<string> {
    const user = await this.get<any>("/user");
    return user.login;
  }

  async listRepos(): Promise<ForgeRepo[]> {
    const data = await this.get<any[]>(
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
    const data = await this.get<any[]>(`/repos/${seg(owner)}/${seg(repo)}/pulls?state=${state}&per_page=50`);
    return data.map(parsePR);
  }

  async getIssues(owner: string, repo: string, state: "open" | "closed" | "all" = "open"): Promise<ForgeIssue[]> {
    const data = await this.get<any[]>(`/repos/${seg(owner)}/${seg(repo)}/issues?state=${state}&per_page=50`);
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
