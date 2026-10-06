import { useRepoStore } from "../store/useRepoStore";
import { useUiStore } from "../store/useUiStore";
import { useTabsStore } from "../store/useTabsStore";
import {
  createBranch, fetchRemote, openNewWindow, pull, push, stashApply, stashSave,
} from "../ipc/commands";
import { reportMerge, runGit } from "../lib/actions";
import { chooseAndInitRepo, chooseAndOpenRepo, openRepoAt } from "../lib/repoActions";
import { ContextMenu, useContextMenu, type MenuEntry } from "./ContextMenu";
import { SearchBar } from "./SearchBar";
import { checkForUpdates } from "../lib/updater";
import logoMark from "../assets/logo-mark.webp";
import type { RepoInfo } from "../types/git";

/** Position courante affichée dans la barre d'outils. */
function headLabel(info: RepoInfo): string {
  const rebase = info.interactive_rebase;
  if (rebase) return `Rebase interactif ${rebase.step}/${rebase.total}`;
  if (info.head_detached) return `HEAD détaché @ ${info.head_hash?.slice(0, 7)}`;
  return `⎇ ${info.head_branch ?? ""}`;
}

export function Toolbar({ onClone }: { onClone: () => void }) {
  const repoPath = useRepoStore((s) => s.repoPath);
  const info = useRepoStore((s) => s.info);
  const branches = useRepoStore((s) => s.branches);
  const stashes = useRepoStore((s) => s.stashes);
  const recent = useRepoStore((s) => s.recentRepos);
  const newTab = useTabsStore((s) => s.newTab);
  const closeTab = useTabsStore((s) => s.closeTab);
  const activeTab = useTabsStore((s) => s.activeId);
  const tabCount = useTabsStore((s) => s.tabs.length);
  const busy = useUiStore((s) => s.busy);
  const ask = useUiStore((s) => s.ask);
  const { menu, open: openMenu, close: closeMenu } = useContextMenu();

  const head = branches.find((b) => b.is_head && !b.is_remote);
  const repoName = repoPath?.split(/[\\/]/).pop();

  function repoMenu(): MenuEntry[] {
    return [
      { label: "Ouvrir un dépôt…", action: chooseAndOpenRepo },
      { label: "Cloner un dépôt…", action: onClone },
      { label: "Initialiser un dépôt…", action: chooseAndInitRepo },
      { label: "Nouvel onglet (Ctrl+T)", action: newTab },
      { label: "Nouvelle fenêtre", action: () => openNewWindow() },
      { label: "Rechercher des mises à jour…", action: () => checkForUpdates(true) },
      ...(recent.filter((p) => p !== repoPath).length > 0 ? ["separator" as const] : []),
      ...recent
        .filter((p) => p !== repoPath)
        .map((p) => ({ label: p.split(/[\\/]/).pop() ?? p, hint: p, action: () => openRepoAt(p) })),
      ...(repoPath || tabCount > 1 ? ["separator" as const, { label: "Fermer l'onglet (Ctrl+W)", action: () => closeTab(activeTab) }] : []),
    ];
  }

  async function doPull(rebase: boolean) {
    if (!repoPath) return;
    const result = await runGit(() => pull(repoPath, rebase), { busy: rebase ? "Pull (rebase)…" : "Pull…" });
    reportMerge(result, "Pull terminé");
  }

  async function doPush(force = false) {
    if (!repoPath || !info?.head_branch) return;
    if (force) {
      const ok = await ask({
        title: "Push forcé",
        message: `Écraser la branche distante de « ${info.head_branch} » avec la version locale ?\nLes commits distants absents en local seront perdus.`,
        danger: true,
        confirmLabel: "Forcer le push",
      });
      if (!ok) return;
    }
    await runGit(() => push(repoPath, { force }), {
      busy: "Push…",
      success: head?.upstream ? `Push de ${info.head_branch} terminé` : `${info.head_branch} publiée sur le remote`,
    });
  }

  async function doFetch() {
    if (!repoPath) return;
    await runGit(() => fetchRemote(repoPath), { busy: "Fetch…", success: "Fetch terminé" });
  }

  async function doBranch() {
    if (!repoPath) return;
    const result = await ask({
      title: "Nouvelle branche",
      message: `Depuis ${info?.head_branch ?? "HEAD"}`,
      input: { placeholder: "nom-de-branche" },
      checkbox: { label: "Basculer sur la nouvelle branche", initial: true },
      confirmLabel: "Créer",
    });
    const name = result?.value.trim();
    if (!name) return;
    await runGit(() => createBranch(repoPath, name, "HEAD", result!.checked), { success: `Branche ${name} créée` });
  }

  async function doStash() {
    if (!repoPath) return;
    const result = await ask({
      title: "Mettre de côté (stash)",
      input: { placeholder: "Message (optionnel)" },
      checkbox: { label: "Inclure les fichiers non suivis", initial: true },
      confirmLabel: "Stash",
    });
    if (!result) return;
    await runGit(() => stashSave(repoPath, result.value.trim() || null, result.checked), { success: "Modifications mises de côté" });
  }

  async function doPop() {
    if (!repoPath || stashes.length === 0) return;
    await runGit(() => stashApply(repoPath, 0, true), { success: "Stash réappliqué" });
  }

  const disabled = !repoPath || !!busy;

  return (
    <header className="flex items-center gap-1.5 px-3 h-11 shrink-0 bg-[var(--color-bg-secondary)] border-b border-white/10">
      <button
        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/10 max-w-60"
        onClick={(e) => openMenu(e, repoMenu())}
        title={repoPath ?? undefined}
      >
        <img
          src={logoMark}
          alt=""
          width={24}
          height={24}
          draggable={false}
          className="w-6 h-6 rounded-md ring-1 ring-white/10 shrink-0 select-none"
        />
        <span className="text-sm font-semibold text-[var(--color-text)] truncate">{repoName ?? "J6N"}</span>
        <span className="text-[10px] text-[var(--color-muted)]">▾</span>
      </button>
      {info && (
        <span className="text-xs font-mono text-[var(--color-accent)] truncate max-w-48" title="Branche courante">
          {headLabel(info)}
        </span>
      )}

      <div className="w-px h-5 bg-white/10 mx-1" />

      <ToolBtn
        label="Pull"
        icon="⇣"
        badge={head?.behind}
        disabled={disabled || !head}
        onClick={() => doPull(false)}
        onMenu={(e) => openMenu(e, [
          { label: "Pull (fast-forward si possible, sinon merge)", action: () => doPull(false) },
          { label: "Pull (rebase)", action: () => doPull(true) },
        ])}
      />
      <ToolBtn
        label="Push"
        icon="⇡"
        badge={head?.ahead}
        disabled={disabled || !head}
        onClick={() => doPush(false)}
        onMenu={(e) => openMenu(e, [
          { label: "Push", action: () => doPush(false) },
          { label: "Push forcé…", action: () => doPush(true), danger: true },
        ])}
      />
      <ToolBtn label="Fetch" icon="⟳" disabled={disabled} onClick={doFetch} />
      <ToolBtn label="Branche" icon="⎇" disabled={disabled || !info?.head_hash} onClick={doBranch} />
      <ToolBtn label="Stash" icon="⊟" disabled={disabled} onClick={doStash} />
      <ToolBtn label="Pop" icon="⊞" badge={stashes.length || undefined} disabled={disabled || stashes.length === 0} onClick={doPop} />

      {busy && <span className="text-xs text-[var(--color-muted)] animate-pulse ml-2">{busy}</span>}

      <div className="ml-auto flex items-center gap-2">
        <SearchBar />
        <button
          className="text-xs px-2 py-1 rounded text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-white/10"
          onClick={() => openNewWindow()}
          title="Ouvrir une nouvelle fenêtre"
        >
          ⧉
        </button>
      </div>

      {menu && <ContextMenu menu={menu} onClose={closeMenu} />}
    </header>
  );
}

function ToolBtn({ label, icon, badge, disabled, onClick, onMenu }: {
  label: string;
  icon: string;
  badge?: number;
  disabled?: boolean;
  onClick: () => void;
  onMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex items-stretch">
      <button
        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-l rounded-r-none hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent text-[var(--color-text)]"
        style={onMenu ? undefined : { borderRadius: 4 }}
        onClick={onClick}
        disabled={disabled}
        title={label}
      >
        <span className="opacity-80">{icon}</span>
        {label}
        {!!badge && (
          <span className="text-[9px] px-1 rounded-full bg-[var(--color-accent)]/80 text-white leading-4">{badge}</span>
        )}
      </button>
      {onMenu && (
        <button
          className="text-[9px] px-1 rounded-r hover:bg-white/10 disabled:opacity-40 text-[var(--color-muted)]"
          disabled={disabled}
          onClick={onMenu}
          aria-label={`Options ${label}`}
        >
          ▾
        </button>
      )}
    </div>
  );
}

