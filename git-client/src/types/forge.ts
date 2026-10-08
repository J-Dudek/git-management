export type Provider = "github" | "gitlab";

/** Compte persisté côté Rust ; le token est stocké à part dans le trousseau système. */
export interface ForgeAccount {
  id: string;
  provider: Provider;
  label: string;
  /** URL web de l'instance : https://github.com, https://gitlab.com ou une instance auto-hébergée. */
  base_url: string;
  username: string;
  /** "pat" : token personnel ; "oauth" : connexion par navigateur (renouvelée automatiquement). */
  auth: "pat" | "oauth";
}

/** Compte enregistré : `secure_storage` est faux si le secret a dû être écrit dans un fichier (pas de trousseau). */
export interface SavedAccount {
  account: ForgeAccount;
  secure_storage: boolean;
}

/** Code à saisir dans le navigateur (device flow OAuth). */
export interface DeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string | null;
  expires_in: number;
  interval: number;
}

export interface ForgeRepo {
  name: string;
  fullName: string;
  cloneUrl: string;
  sshUrl: string;
  private: boolean;
  description: string;
  updatedAt: string;
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

export interface ForgeUser {
  /** Identifiant numérique (GitLab l'exige pour assigner) ; GitHub utilise le login. */
  id: number;
  username: string;
  name: string;
}

export interface ForgeLabel {
  name: string;
  /** Couleur hexadécimale avec « # ». */
  color: string;
}

export interface ForgeMilestone {
  /** Numéro (GitHub) ou id (GitLab) attendu par l'API de création. */
  id: number;
  title: string;
}

/** Valeurs proposables dans le formulaire de création d'une PR / MR. */
export interface PullRequestOptions {
  defaultBranch: string;
  users: ForgeUser[];
  labels: ForgeLabel[];
  milestones: ForgeMilestone[];
  /** Réglages par défaut du projet GitLab (cases pré-cochées). */
  squashDefault: boolean;
  removeSourceBranchDefault: boolean;
}

export interface NewPullRequest {
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string;
  draft: boolean;
  assignees: ForgeUser[];
  reviewers: ForgeUser[];
  labels: string[];
  milestone: ForgeMilestone | null;
  /** GitLab : supprimer la branche source après le merge. */
  removeSourceBranch: boolean;
  /** GitLab : squasher les commits au merge. */
  squash: boolean;
}

export interface CreatedPullRequest {
  pr: ForgePR;
  /** Étapes secondaires échouées (relecteurs, labels…) : la PR existe quand même. */
  warnings: string[];
}

export interface AccountData {
  prs: ForgePR[];
  issues: ForgeIssue[];
  loading: boolean;
  error: string | null;
}
