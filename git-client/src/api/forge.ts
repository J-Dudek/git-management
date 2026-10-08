import { GitHubClient } from "./github";
import { GitLabClient } from "./gitlab";
import { forgeApi, forgeApiSend } from "../ipc/commands";
import type {
  CreatedPullRequest, ForgeAccount, ForgeIssue, ForgePR, ForgeRepo, NewPullRequest, PullRequestOptions,
} from "../types/forge";

/** Interface commune GitHub / GitLab. `projectPath` = "owner/repo" ou "group/sub/repo". */
export interface ForgeClient {
  getCurrentUser(): Promise<string>;
  listRepos(): Promise<ForgeRepo[]>;
  getPullRequests(projectPath: string): Promise<ForgePR[]>;
  getIssues(projectPath: string): Promise<ForgeIssue[]>;
  /** Branche par défaut, membres, labels, jalons du projet pour le formulaire de création. */
  getPullRequestOptions(projectPath: string): Promise<PullRequestOptions>;
  /** Crée une pull request (GitHub) / merge request (GitLab). */
  createPullRequest(projectPath: string, input: NewPullRequest): Promise<CreatedPullRequest>;
}

/** Client d'API d'un compte : les requêtes passent par le backend, qui seul détient le token. */
export function forgeClient(account: ForgeAccount): ForgeClient {
  const get = <T,>(path: string) => forgeApi(account.id, path) as Promise<T>;
  const send = <T,>(method: "POST" | "PUT" | "PATCH", path: string, body: unknown) =>
    forgeApiSend(account.id, method, path, body) as Promise<T>;
  if (account.provider === "github") {
    const client = new GitHubClient(get, send);
    const split = (path: string) => {
      const [owner, repo] = path.split("/");
      return [owner, repo] as const;
    };
    return {
      getCurrentUser: () => client.getCurrentUser(),
      listRepos: () => client.listRepos(),
      getPullRequests: (path) => client.getPullRequests(...split(path)),
      getIssues: (path) => client.getIssues(...split(path)),
      getPullRequestOptions: (path) => client.getPullRequestOptions(...split(path)),
      createPullRequest: (path, input) => client.createPullRequest(...split(path), input),
    };
  }
  const client = new GitLabClient(get, send);
  return {
    getCurrentUser: () => client.getCurrentUser(),
    listRepos: () => client.listRepos(),
    getPullRequests: (path) => client.getMergeRequests(path),
    getIssues: (path) => client.getIssues(path),
    getPullRequestOptions: (path) => client.getMergeRequestOptions(path),
    createPullRequest: (path, input) => client.createMergeRequest(path, input),
  };
}
