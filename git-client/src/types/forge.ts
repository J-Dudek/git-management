export type Provider = "github" | "gitlab";

export interface ForgeAccount {
  id: string;
  provider: Provider;
  label: string;
  token: string;
  // GitHub
  owner?: string;
  repo?: string;
  // GitLab
  baseUrl?: string;   // "https://gitlab.com" ou URL self-hosted
  project?: string;   // "namespace/repo" ou ID numérique
}

export interface ForgePR {
  number: number;
  title: string;
  state: "open" | "closed" | "merged";
  author: string;
  url: string;
  createdAt: string;
  draft: boolean;
  labels: string[];
  sourceBranch: string;
  targetBranch: string;
}

export interface ForgeIssue {
  number: number;
  title: string;
  state: "open" | "closed";
  author: string;
  url: string;
  createdAt: string;
  labels: string[];
}

export interface AccountData {
  prs: ForgePR[];
  issues: ForgeIssue[];
  loading: boolean;
  error: string | null;
}
