import { GitHubClient } from "./github";
import { GitLabClient } from "./gitlab";
import { forgeApi } from "../ipc/commands";
import type { ForgeAccount, ForgeIssue, ForgePR, ForgeRepo } from "../types/forge";

/** Interface commune GitHub / GitLab. `projectPath` = "owner/repo" ou "group/sub/repo". */
export interface ForgeClient {
  getCurrentUser(): Promise<string>;
  listRepos(): Promise<ForgeRepo[]>;
  getPullRequests(projectPath: string): Promise<ForgePR[]>;
  getIssues(projectPath: string): Promise<ForgeIssue[]>;
}

/** Client d'API d'un compte : les requêtes passent par le backend, qui seul détient le token. */
export function forgeClient(account: ForgeAccount): ForgeClient {
  const get = <T,>(path: string) => forgeApi(account.id, path) as Promise<T>;
  if (account.provider === "github") {
    const client = new GitHubClient(get);
    const split = (path: string) => {
      const [owner, repo] = path.split("/");
      return [owner, repo] as const;
    };
    return {
      getCurrentUser: () => client.getCurrentUser(),
      listRepos: () => client.listRepos(),
      getPullRequests: (path) => client.getPullRequests(...split(path)),
      getIssues: (path) => client.getIssues(...split(path)),
    };
  }
  const client = new GitLabClient(get);
  return {
    getCurrentUser: () => client.getCurrentUser(),
    listRepos: () => client.listRepos(),
    getPullRequests: (path) => client.getMergeRequests(path),
    getIssues: (path) => client.getIssues(path),
  };
}
