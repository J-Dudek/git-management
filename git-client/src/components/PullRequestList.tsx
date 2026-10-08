import { useCallback, useEffect, useReducer, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useAccountsStore } from "../store/useAccountsStore";
import { useRepoStore } from "../store/useRepoStore";
import { checkoutRemoteBranch, fetchRemote } from "../ipc/commands";
import { errorMessage, runGit } from "../lib/actions";
import { remoteForAccount } from "../lib/remoteUrl";
import { ContextMenu, useContextMenu } from "./ContextMenu";
import { PullRequestReviewDialog } from "./PullRequestReviewDialog";
import type { ForgeAccount, ForgePR, PullRequestState } from "../types/forge";
import type { RemoteInfo } from "../types/git";

/** Compte et projet de la forge qui hébergent un remote du dépôt courant. */
export interface LinkedForge {
  account: ForgeAccount;
  /** "owner/repo" ou "group/sub/repo". */
  projectPath: string;
  remoteName: string;
}

/** Premier compte dont l'instance héberge un de ces remotes (origin en priorité). */
export function linkedForge(remotes: RemoteInfo[], accounts: ForgeAccount[]): LinkedForge | null {
  for (const account of accounts) {
    const match = remoteForAccount(remotes, account);
    if (match) return { account, projectPath: match.path, remoteName: match.remote.name };
  }
  return null;
}

/** Forge liée au dépôt courant. */
export function useLinkedForge(): LinkedForge | null {
  const remotes = useRepoStore((s) => s.remotes);
  const accounts = useAccountsStore((s) => s.accounts);
  return linkedForge(remotes, accounts);
}

/** Checkout de la branche source d'une PR, après un fetch si elle n'est pas encore connue localement. */
export async function checkoutPullRequest(remoteName: string, pr: ForgePR) {
  const { repoPath, branches } = useRepoStore.getState();
  if (!repoPath) return;
  const remoteBranch = `${remoteName}/${pr.sourceBranch}`;
  if (!branches.some((b) => b.is_remote && b.name === remoteBranch)) {
    await runGit(() => fetchRemote(repoPath, remoteName), { busy: "Fetch…", refresh: false });
  }
  await runGit(() => checkoutRemoteBranch(repoPath, remoteBranch), { success: `Checkout de ${pr.sourceBranch}` });
}

export type PrScope = "all" | "mine" | "review" | "assigned";

function matchesScope(pr: ForgePR, scope: PrScope, me: string): boolean {
  switch (scope) {
    case "mine": return pr.author === me;
    case "review": return pr.reviewers.includes(me);
    case "assigned": return pr.assignees.includes(me);
    default: return true;
  }
}

/**
 * Dernières PR chargées par compte, projet et filtre d'état. Gardées au niveau du module pour survivre au
 * démontage de la liste (changement d'onglet) : les badges des branches restent affichés pendant l'actualisation.
 */
const cache = new Map<string, { open: ForgePR[]; filtered: ForgePR[] }>();

/** Listes affichées à prévenir quand le cache est actualisé hors d'elles (synchronisation périodique). */
const listeners = new Set<() => void>();

/** Vide le cache (tests). */
export function clearPullRequestCache() {
  cache.clear();
}

/**
 * Recharge les PR ouvertes d'un projet dans le cache et met à jour les listes affichées.
 * Renvoie les PR ouvertes connues avant (null si jamais chargées) et après.
 */
export async function refreshOpenPullRequests(account: ForgeAccount, projectPath: string) {
  const key = `${account.id}|${projectPath}|open`;
  const before = cache.get(key)?.open ?? null;
  const open = await (await useAccountsStore.getState().client(account)).getPullRequests(projectPath, "open");
  cache.set(key, { open, filtered: open });
  listeners.forEach((l) => l());
  return { before, after: open };
}

/**
 * PR / MR du projet, filtrées par état (côté forge) et par personne (localement). Les données en cache sont
 * affichées tout de suite et actualisées en arrière-plan ; `loading` n'est vrai qu'au premier chargement.
 */
export function usePullRequests(forge: LinkedForge | null) {
  const client = useAccountsStore((s) => s.client);
  const [state, setState] = useState<PullRequestState>("open");
  const [scope, setScope] = useState<PrScope>("all");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, refreshed] = useReducer((n: number) => n + 1, 0);
  const account = forge?.account;
  const projectPath = forge?.projectPath;
  const key = account && projectPath ? `${account.id}|${projectPath}|${state}` : null;
  const entry = key ? cache.get(key) : undefined;
  const openEntry = account && projectPath ? cache.get(`${account.id}|${projectPath}|open`) : undefined;

  const reload = useCallback(async () => {
    if (!account || !projectPath || !key) return;
    setFetching(true);
    setError(null);
    try {
      const c = await client(account);
      const [open, filtered] = await Promise.all([
        c.getPullRequests(projectPath, "open"),
        state === "open" ? null : c.getPullRequests(projectPath, state),
      ]);
      cache.set(key, { open, filtered: filtered ?? open });
      // Les badges lisent les PR ouvertes : le cache du filtre « ouvertes » suit aussi.
      cache.set(`${account.id}|${projectPath}|open`, { open, filtered: open });
      refreshed();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setFetching(false);
    }
  }, [account, projectPath, key, state, client]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    listeners.add(refreshed);
    return () => {
      listeners.delete(refreshed);
    };
  }, []);

  const prs = entry?.filtered ?? [];
  const visible = account ? prs.filter((pr) => matchesScope(pr, scope, account.username)) : [];
  return {
    prs: visible,
    /** PR ouvertes, quel que soit le filtre : badges des branches. */
    openPrs: openEntry?.open ?? [],
    loading: fetching && !entry,
    error,
    reload,
    state,
    setState,
    scope,
    setScope,
  };
}

export type PullRequestsState = ReturnType<typeof usePullRequests>;

const filterClass = "flex-1 min-w-0 bg-black/30 border border-white/10 rounded px-1 py-0.5 text-[10px] text-[var(--color-text)] outline-none";

/** Filtres, lignes de PR / MR et panneau de revue. `indent` aligne les lignes sur celles de la barre latérale. */
export function PullRequestList({ forge, list, indent = 12 }: { forge: LinkedForge; list: PullRequestsState; indent?: number }) {
  const [reviewing, setReviewing] = useState<number | null>(null);
  const { menu, open, close } = useContextMenu();
  const { account, projectPath, remoteName } = forge;
  const prLabel = account.provider === "gitlab" ? "MR" : "PR";

  const checkoutPr = (pr: ForgePR) => checkoutPullRequest(remoteName, pr);

  return (
    <>
      <div className="flex gap-1 pr-2 pb-1" style={{ paddingLeft: indent - 4 }}>
        <select
          className={filterClass}
          value={list.state}
          onChange={(e) => list.setState(e.target.value as PullRequestState)}
          aria-label={`État des ${prLabel}s`}
        >
          <option value="open">Ouvertes</option>
          <option value="merged">Mergées</option>
          <option value="closed">Fermées</option>
          <option value="all">Toutes</option>
        </select>
        <select
          className={filterClass}
          value={list.scope}
          onChange={(e) => list.setScope(e.target.value as PrScope)}
          aria-label={`Filtrer les ${prLabel}s`}
        >
          <option value="all">Tout le monde</option>
          <option value="mine">Les miennes</option>
          <option value="review">À relire par moi</option>
          <option value="assigned">Assignées à moi</option>
        </select>
      </div>
      {list.loading && <p className="py-1 text-xs text-[var(--color-muted)] animate-pulse" style={{ paddingLeft: indent }}>Chargement…</p>}
      {list.error && <p className="pr-3 py-1 text-xs text-red-400 break-words" style={{ paddingLeft: indent }}>{list.error}</p>}
      {!list.loading && !list.error && (
        <>
          {list.prs.map((pr) => (
            <PRRow
              key={pr.number}
              pr={pr}
              typeLabel={prLabel}
              indent={indent}
              onClick={() => setReviewing(pr.number)}
              onContextMenu={(e) => open(e, [
                { label: "Voir le détail…", action: () => setReviewing(pr.number) },
                { label: `Checkout ${pr.sourceBranch}`, action: () => checkoutPr(pr) },
                { label: "Ouvrir dans le navigateur", action: () => openUrl(pr.url) },
              ])}
            />
          ))}
          {list.prs.length === 0 && (
            <p className="py-1 text-xs text-[var(--color-muted)] italic" style={{ paddingLeft: indent }}>Aucune {prLabel} pour ce filtre</p>
          )}
        </>
      )}
      {menu && <ContextMenu menu={menu} onClose={close} />}
      {reviewing !== null && (
        <PullRequestReviewDialog
          account={account}
          projectPath={projectPath}
          remoteName={remoteName}
          number={reviewing}
          onCheckout={checkoutPr}
          onChanged={list.reload}
          onClose={() => setReviewing(null)}
        />
      )}
    </>
  );
}

const PR_STATE_COLORS: Record<ForgePR["state"], string> = {
  open: "text-green-400",
  merged: "text-purple-400",
  closed: "text-red-400",
};

function PRRow({ pr, typeLabel, indent, onClick, onContextMenu }: {
  pr: ForgePR;
  typeLabel: string;
  indent: number;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className="pr-3 py-1.5 hover:bg-white/5 cursor-pointer"
      style={{ paddingLeft: indent }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title="Clic : voir le détail · Clic droit : checkout, navigateur"
    >
      <div className="flex items-start gap-2">
        <span className={`${PR_STATE_COLORS[pr.state]} shrink-0 text-xs`}>●</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[var(--color-text)] truncate">{pr.title}</p>
          <p className="text-[10px] text-[var(--color-muted)] truncate">
            {typeLabel}#{pr.number} · {pr.author} · {pr.sourceBranch} → {pr.targetBranch}
          </p>
        </div>
        {pr.draft && <span className="text-[9px] border border-white/20 px-1 rounded text-[var(--color-muted)] shrink-0">draft</span>}
      </div>
    </div>
  );
}
