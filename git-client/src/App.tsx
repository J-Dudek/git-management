import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Toolbar } from "./components/Toolbar";
import { TabBar } from "./components/TabBar";
import { Sidebar } from "./components/Sidebar";
import { AccountsPanel } from "./components/AccountsPanel";
import { CommitGraph } from "./graph/CommitGraph";
import { StagingPanel } from "./components/StagingPanel";
import { CommitDetails } from "./components/CommitDetails";
import { CenterDiff } from "./components/CenterDiff";
import { ConflictViewer } from "./components/ConflictViewer";
import { CloneDialog } from "./components/CloneDialog";
import { Welcome } from "./components/Welcome";
import { Dialog } from "./components/Dialog";
import { Toasts } from "./components/Toasts";
import { InteractiveRebaseDialog } from "./components/InteractiveRebaseDialog";
import { useRepoStore } from "./store/useRepoStore";
import { useAccountsStore } from "./store/useAccountsStore";
import { useUiStore } from "./store/useUiStore";
import { persistTabSession, useTabsStore } from "./store/useTabsStore";
import { errorMessage } from "./lib/actions";
import { chooseAndInitRepo, chooseAndOpenRepo, openRepoAt } from "./lib/repoActions";
import { checkForUpdatesOnStartup } from "./lib/updater";

type LeftTab = "repo" | "accounts";

export default function App() {
  const [leftTab, setLeftTab] = useState<LeftTab>("repo");
  const [showClone, setShowClone] = useState(false);
  const repoPath = useRepoStore((s) => s.repoPath);
  const center = useRepoStore((s) => s.center);
  const selectedCommit = useRepoStore((s) => s.selectedCommit);
  const setCenter = useRepoStore((s) => s.setCenter);
  const refresh = useRepoStore((s) => s.refresh);
  const loadAccounts = useAccountsStore((s) => s.load);
  const notify = useUiStore((s) => s.notify);
  const activeTab = useTabsStore((s) => s.activeId);
  const rebaseBase = useUiStore((s) => s.interactiveRebaseBase);
  const setRebaseBase = useUiStore((s) => s.setInteractiveRebaseBase);

  useEffect(() => {
    loadAccounts().catch((e) => notify("error", `Comptes : ${errorMessage(e)}`));
  }, [loadAccounts, notify]);

  // Pas de menu contextuel natif du webview (Recharger, Inspecter…) hors des champs de saisie.
  useEffect(() => {
    function onContextMenu(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("input, textarea, [contenteditable=true]")) e.preventDefault();
    }
    window.addEventListener("contextmenu", onContextMenu);
    return () => window.removeEventListener("contextmenu", onContextMenu);
  }, []);

  useEffect(() => {
    checkForUpdatesOnStartup();
  }, []);

  // Fenêtre ouverte sur un dépôt précis (ex. un sous-module) : voir window.rs.
  // La fenêtre principale rouvre les onglets de la session précédente et les mémorise.
  useEffect(() => {
    const repo = (window as { __GIT_CLIENT_OPEN_REPO__?: string | null }).__GIT_CLIENT_OPEN_REPO__;
    if (repo) openRepoAt(repo);
    if (getCurrentWindow().label === "main") return persistTabSession(!repo);
  }, []);

  // Les fichiers ont pu changer dans un éditeur externe : on rafraîchit au retour sur la fenêtre.
  useEffect(() => {
    if (!repoPath) return;
    const onFocus = () => {
      if (!useUiStore.getState().busy) refresh().catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [repoPath, refresh]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !useUiStore.getState().dialog && useRepoStore.getState().center.kind !== "graph") {
        setCenter({ kind: "graph" });
      }
      if (e.key === "F5" || ((e.ctrlKey || e.metaKey) && e.key === "r")) {
        e.preventDefault();
        refresh().catch((err) => notify("error", errorMessage(err)));
      }
      if (useUiStore.getState().dialog) return;
      const tabs = useTabsStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "t") {
        e.preventDefault();
        tabs.newTab();
      } else if (mod && e.key.toLowerCase() === "w") {
        e.preventDefault();
        tabs.closeTab(tabs.activeId);
      } else if (mod && (e.key === "Tab" || e.key === "PageDown" || e.key === "PageUp")) {
        e.preventDefault();
        const back = e.key === "PageUp" || (e.key === "Tab" && e.shiftKey);
        const i = tabs.tabs.findIndex((t) => t.id === tabs.activeId);
        const n = tabs.tabs.length;
        tabs.switchTab(tabs.tabs[(i + (back ? n - 1 : 1)) % n].id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCenter, refresh, notify]);

  function leftPane() {
    if (leftTab === "accounts") return <AccountsPanel />;
    return repoPath ? <Sidebar /> : <p className="p-3 text-xs text-[var(--color-muted)] italic">Aucun dépôt ouvert</p>;
  }

  function mainPane() {
    if (!repoPath) {
      return (
        <Welcome
          onOpen={chooseAndOpenRepo}
          onInit={chooseAndInitRepo}
          onClone={() => setShowClone(true)}
          onOpenPath={openRepoAt}
        />
      );
    }
    if (center.kind === "diff") return <CenterDiff view={center} />;
    if (center.kind === "conflict") return <ConflictViewer path={center.path} />;
    return <CommitGraph />;
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <Toolbar onClone={() => setShowClone(true)} />
      <TabBar />

      {/* Remonté à chaque changement d'onglet : pas de sélection d'un dépôt appliquée à un autre. */}
      <div key={activeTab} className="flex flex-1 overflow-hidden">
        <div className="w-60 shrink-0 flex flex-col overflow-hidden border-r border-white/10 bg-[var(--color-bg-secondary)]">
          <div className="flex shrink-0 border-b border-white/10">
            <LeftTabBtn active={leftTab === "repo"} onClick={() => setLeftTab("repo")}>Dépôt</LeftTabBtn>
            <LeftTabBtn active={leftTab === "accounts"} onClick={() => setLeftTab("accounts")}>Comptes</LeftTabBtn>
          </div>
          <div className="flex-1 overflow-hidden">{leftPane()}</div>
        </div>

        <main className="flex-1 min-w-0 overflow-hidden bg-[var(--color-bg-primary)]">{mainPane()}</main>

        {repoPath && (
          <div className="w-80 shrink-0 overflow-hidden border-l border-white/10">
            {selectedCommit ? <CommitDetails commit={selectedCommit} /> : <StagingPanel />}
          </div>
        )}
      </div>

      {showClone && <CloneDialog onClose={() => setShowClone(false)} />}
      {rebaseBase && repoPath && <InteractiveRebaseDialog base={rebaseBase} onClose={() => setRebaseBase(null)} />}
      <Dialog />
      <Toasts />
    </div>
  );
}

function LeftTabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-[10px] font-bold uppercase tracking-widest py-2 transition-colors ${
        active
          ? "text-[var(--color-text)] border-b-2 border-[var(--color-accent)]"
          : "text-[var(--color-muted)] hover:text-[var(--color-text)] border-b-2 border-transparent"
      }`}
    >
      {children}
    </button>
  );
}
