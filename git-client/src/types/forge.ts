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
  /** Relecteurs demandés (logins). */
  reviewers: string[];
  assignees: string[];
}

/** Filtre d'état de la liste des PR / MR. */
export type PullRequestState = "open" | "merged" | "closed" | "all";

/** Mode de merge : GitHub propose les trois selon le dépôt ; GitLab merge selon le projet, avec squash optionnel. */
export type MergeMethod = "merge" | "squash" | "rebase";

/** Job de CI (GitHub : check run ou statut ; GitLab : job du pipeline). */
export interface ForgeCheck {
  name: string;
  status: "pending" | "success" | "failure" | "skipped";
  url: string | null;
}

export interface ForgeComment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  /** Avis de relecture associé (GitHub), affiché avec le commentaire. */
  review?: "approved" | "changes_requested";
}

/** Détail d'une PR / MR pour le panneau de revue. */
export interface PullRequestDetails {
  pr: ForgePR;
  description: string;
  /** Commit de tête : envoyé au merge pour refuser si la branche a bougé entre-temps. */
  headSha: string;
  approvedBy: string[];
  /** GitHub : relecteurs dont le dernier avis demande des changements. */
  changesRequestedBy: string[];
  approvedByMe: boolean;
  /** GitLab : approbations encore requises (null si non applicable). */
  approvalsLeft: number | null;
  checks: ForgeCheck[];
  /** Merge possible maintenant (droits, conflits, CI, brouillon…). */
  mergeable: boolean;
  /** Explication lisible de l'état de merge. */
  mergeStatus: string;
  /** La branche est en retard sur la cible et peut être mise à jour depuis la forge. */
  canUpdateBranch: boolean;
  mergeMethods: MergeMethod[];
  defaultMergeMethod: MergeMethod;
  /** GitLab : case « supprimer la branche source » pré-cochée. */
  removeSourceBranchDefault: boolean;
  /** GitLab : commits de référence exigés pour positionner un commentaire dans le diff. */
  diffRefs: DiffRefs | null;
}

export interface DiffRefs {
  baseSha: string;
  startSha: string;
  headSha: string;
}

/** Côté du diff : ancienne version (ligne supprimée) ou nouvelle (ajoutée ou inchangée). */
export type DiffSide = "old" | "new";

/** Emplacement d'un commentaire dans le diff. */
export interface LinePosition {
  path: string;
  /** Chemin avant renommage. */
  oldPath: string;
  side: DiffSide;
  /** Numéro de ligne du côté `side`. */
  line: number;
  /** Numéros des deux côtés : GitLab les exige tous deux pour une ligne inchangée. */
  oldLine: number | null;
  newLine: number | null;
}

/** Fil de commentaires attaché à une ligne du diff. */
export interface ReviewThread {
  /** GitHub : id GraphQL du fil ; GitLab : id de la discussion. */
  id: string;
  /** GitHub : id du commentaire auquel répondre ; GitLab : id de la discussion. */
  replyTo: string;
  path: string;
  side: DiffSide;
  /** null : la ligne n'existe plus dans la version actuelle (commentaire obsolète). */
  line: number | null;
  /** null : fil non résoluble. */
  resolved: boolean | null;
  comments: ForgeComment[];
}

/** Commentaire de ligne préparé localement, publié avec la revue. */
export interface DraftComment {
  id: string;
  position: LinePosition;
  body: string;
}

export type ReviewVerdict = "comment" | "approve" | "request_changes";

export interface ReviewSubmission {
  verdict: ReviewVerdict;
  body: string;
  comments: DraftComment[];
}

/** Ce que la forge exige pour commenter une version précise du diff. */
export interface ReviewContext {
  headSha: string;
  diffRefs: DiffRefs | null;
}

/** Résultat d'une revue : GitLab publie commentaire par commentaire, un échec n'annule pas le reste. */
export interface SubmittedReview {
  publishedIds: string[];
  errors: string[];
}

export interface MergeOptions {
  method: MergeMethod;
  sha: string;
  /** GitLab uniquement : GitHub ne permet pas de supprimer la branche par l'API acceptée ici. */
  removeSourceBranch: boolean;
}

export type ReviewEvent = "approve" | "unapprove" | "request_changes";

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

/** Modèle de description de PR / MR défini dans le projet (ou hérité du groupe / de l'instance sur GitLab). */
export interface PrTemplate {
  name: string;
  content: string;
}

export interface PrTemplates {
  templates: PrTemplate[];
  /** Modèle que la forge applique d'office à une nouvelle PR / MR, null si aucun. */
  defaultName: string | null;
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
  issues: ForgeIssue[];
  loading: boolean;
  error: string | null;
}
