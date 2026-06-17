import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useRepoStore } from "../store/useRepoStore";
import { openRepository, getCommits, getBranches, getStatus, initRepository, cloneRepository, fetchRemote, openNewWindow } from "../ipc/commands";

export function Toolbar() {
  const setRepoPath = useRepoStore((s) => s.setRepoPath);
  const setCommits = useRepoStore((s) => s.setCommits);
  const setBranches = useRepoStore((s) => s.setBranches);
  const setStatus = useRepoStore((s) => s.setStatus);
  const setHeadBranch = useRepoStore((s) => s.setHeadBranch);
  const repoPath = useRepoStore((s) => s.repoPath);
  const [cloneUrl, setCloneUrl] = useState("");
  const [showClone, setShowClone] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadRepo(path: string) {
    const { head_branch } = await openRepository(path);
    setRepoPath(path);
    setHeadBranch(head_branch);
    const [commits, branches, status] = await Promise.all([
      getCommits(path, 500),
      getBranches(path),
      getStatus(path),
    ]);
    setCommits(commits);
    setBranches(branches);
    setStatus(status);
  }

  async function handleOpen() {
    setError(null);
    const selected = await open({ directory: true, multiple: false });
    if (!selected || typeof selected !== "string") return;
    await loadRepo(selected);
  }

  async function handleInit() {
    setError(null);
    const selected = await open({ directory: true, multiple: false });
    if (!selected || typeof selected !== "string") return;
    await initRepository(selected);
    await loadRepo(selected);
  }

  async function handleClone() {
    if (!cloneUrl.trim()) return;
    setError(null);
    setCloning(true);
    try {
      const dest = await open({ directory: true, multiple: false });
      if (!dest || typeof dest !== "string") return;
      const repoName = cloneUrl.split("/").pop()?.replace(/\.git$/, "") ?? "repo";
      const targetPath = `${dest}/${repoName}`;
      await cloneRepository(cloneUrl.trim(), targetPath);
      await loadRepo(targetPath);
      setShowClone(false);
      setCloneUrl("");
    } catch (e) {
      setError(String(e));
    } finally {
      setCloning(false);
    }
  }

  async function handleFetch() {
    if (!repoPath) return;
    setError(null);
    setFetching(true);
    try {
      await fetchRemote(repoPath);
      const [commits, branches] = await Promise.all([
        getCommits(repoPath, 500),
        getBranches(repoPath),
      ]);
      setCommits(commits);
      setBranches(branches);
    } catch (e) {
      setError(String(e));
    } finally {
      setFetching(false);
    }
  }

  return (
    <header className="flex flex-col shrink-0 bg-[var(--color-bg-secondary)] border-b border-white/10">
      <div className="flex items-center gap-2 px-4 h-10">
        <span className="text-sm font-semibold text-[var(--color-text)] tracking-tight">git-client</span>
        <div className="w-px h-4 bg-white/10" />

        <ToolbarBtn onClick={handleOpen}>Ouvrir</ToolbarBtn>
        <ToolbarBtn onClick={handleInit}>Init</ToolbarBtn>
        <ToolbarBtn onClick={() => { setShowClone((v) => !v); setError(null); }}>
          Cloner
        </ToolbarBtn>
        <ToolbarBtn onClick={() => openNewWindow()} title="Ouvrir une nouvelle fenêtre">+ Fenêtre</ToolbarBtn>

        {repoPath && (
          <>
            <div className="w-px h-4 bg-white/10" />
            <ToolbarBtn onClick={handleFetch} disabled={fetching}>
              {fetching ? "Fetch…" : "Fetch"}
            </ToolbarBtn>
            <span className="text-xs text-[var(--color-muted)] font-mono truncate ml-1">{repoPath}</span>
          </>
        )}

        {error && <span className="text-xs text-red-400 ml-auto truncate">{error}</span>}
      </div>

      {showClone && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-white/10 bg-black/20">
          <input
            autoFocus
            className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]/50 placeholder:text-[var(--color-muted)]"
            placeholder="URL du dépôt (https://…)"
            value={cloneUrl}
            onChange={(e) => setCloneUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleClone()}
          />
          <ToolbarBtn onClick={handleClone} disabled={cloning || !cloneUrl.trim()}>
            {cloning ? "Clonage…" : "Cloner ici"}
          </ToolbarBtn>
          <ToolbarBtn onClick={() => { setShowClone(false); setCloneUrl(""); }}>✕</ToolbarBtn>
        </div>
      )}
    </header>
  );
}

function ToolbarBtn({ onClick, disabled, title, children }: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      className="text-xs px-3 py-1 rounded bg-white/10 hover:bg-white/15 disabled:opacity-40 text-[var(--color-text)] transition-colors"
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}
