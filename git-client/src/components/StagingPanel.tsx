import { useState } from "react";
import { useRepoStore } from "../store/useRepoStore";
import { stageFile, unstageFile, createCommit, getStatus, getDiff } from "../ipc/commands";
import { DiffViewer } from "./DiffViewer";
import { ConflictViewer } from "./ConflictViewer";
import type { FileStatus, FileDiff } from "../types/git";

export function StagingPanel() {
  const repoPath = useRepoStore((s) => s.repoPath);
  const status = useRepoStore((s) => s.status);
  const setStatus = useRepoStore((s) => s.setStatus);
  const [message, setMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileStatus | null>(null);
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const staged = status.filter((f) => f.staged);
  const unstaged = status.filter((f) => !f.staged);

  async function refreshStatus() {
    if (!repoPath) return;
    const s = await getStatus(repoPath);
    setStatus(s);
  }

  async function handleSelectFile(file: FileStatus) {
    if (!repoPath) return;
    setSelectedFile(file);
    setDiff(null);
    setDiffLoading(true);
    try {
      const d = await getDiff(repoPath, file.path, file.staged);
      setDiff(d);
    } finally {
      setDiffLoading(false);
    }
  }

  async function handleStage(file: FileStatus) {
    if (!repoPath) return;
    await stageFile(repoPath, file.path);
    await refreshStatus();
    if (selectedFile?.path === file.path) {
      handleSelectFile({ ...file, staged: true });
    }
  }

  async function handleUnstage(file: FileStatus) {
    if (!repoPath) return;
    await unstageFile(repoPath, file.path);
    await refreshStatus();
    if (selectedFile?.path === file.path) {
      handleSelectFile({ ...file, staged: false });
    }
  }

  async function handleCommit() {
    if (!repoPath || !message.trim() || staged.length === 0) return;
    setCommitting(true);
    setError(null);
    try {
      await createCommit(repoPath, message.trim());
      setMessage("");
      setSelectedFile(null);
      setDiff(null);
      await refreshStatus();
    } catch (e) {
      setError(String(e));
    } finally {
      setCommitting(false);
    }
  }

  if (!repoPath) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-muted)] text-xs">
        Aucun dépôt ouvert
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-secondary)] border-l border-white/10 text-sm">
      {/* Diff / Conflict viewer */}
      {selectedFile && selectedFile.status === "conflicted" ? (
        <div className="border-b border-white/10" style={{ height: "50%" }}>
          <ConflictViewer
            file={selectedFile}
            onResolved={() => { setSelectedFile(null); setDiff(null); }}
          />
        </div>
      ) : (selectedFile || diffLoading) ? (
        <div className="border-b border-white/10" style={{ height: "40%" }}>
          <div className="px-2 py-1 border-b border-white/10 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)]">Diff</span>
            {selectedFile && (
              <span className="text-[10px] font-mono text-[var(--color-muted)] truncate">{selectedFile.path}</span>
            )}
          </div>
          <div style={{ height: "calc(100% - 25px)" }}>
            <DiffViewer diff={diff} loading={diffLoading} />
          </div>
        </div>
      ) : null}

      {/* File lists */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 border-b border-white/10">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)]">Staging</span>
        </div>

        {staged.length > 0 && (
          <FileSection
            title={`Indexé (${staged.length})`}
            files={staged}
            actionLabel="−"
            actionTitle="Désindexer"
            onAction={handleUnstage}
            onSelect={handleSelectFile}
            selectedPath={selectedFile?.path}
            color="text-green-400"
          />
        )}
        {unstaged.length > 0 && (
          <FileSection
            title={`Modifié (${unstaged.length})`}
            files={unstaged}
            actionLabel="+"
            actionTitle="Indexer"
            onAction={handleStage}
            onSelect={handleSelectFile}
            selectedPath={selectedFile?.path}
            color="text-yellow-400"
          />
        )}
        {staged.length === 0 && unstaged.length === 0 && (
          <p className="p-3 text-xs text-[var(--color-muted)] italic">Aucun fichier modifié</p>
        )}
      </div>

      {/* Commit form */}
      <div className="p-2 border-t border-white/10 flex flex-col gap-2">
        {error && <p className="text-xs text-red-400">{error}</p>}
        <textarea
          className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-[var(--color-text)] resize-none outline-none focus:border-[var(--color-accent)]/50 placeholder:text-[var(--color-muted)]"
          rows={3}
          placeholder="Message de commit… (Ctrl+Entrée)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleCommit();
          }}
        />
        <button
          className="bg-[var(--color-accent)] hover:opacity-90 disabled:opacity-40 text-white text-xs font-semibold py-1.5 rounded transition-opacity"
          onClick={handleCommit}
          disabled={committing || !message.trim() || staged.length === 0}
        >
          {committing ? "Commit…" : "Commit"}
        </button>
      </div>
    </div>
  );
}

interface FileSectionProps {
  title: string;
  files: FileStatus[];
  actionLabel: string;
  actionTitle: string;
  onAction: (f: FileStatus) => void;
  onSelect: (f: FileStatus) => void;
  selectedPath: string | undefined;
  color: string;
}

function FileSection({ title, files, actionLabel, actionTitle, onAction, onSelect, selectedPath, color }: FileSectionProps) {
  return (
    <div>
      <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)]">
        {title}
      </p>
      {files.map((f) => (
        <div
          key={f.path}
          className={`flex items-center gap-2 px-3 py-[3px] cursor-pointer group ${
            f.path === selectedPath ? "bg-white/10" : "hover:bg-white/5"
          }`}
          onClick={() => onSelect(f)}
        >
          <StatusBadge status={f.status} color={color} />
          <span className="flex-1 truncate text-[11px] font-mono text-[var(--color-text)]">{f.path}</span>
          <button
            title={actionTitle}
            className="opacity-0 group-hover:opacity-100 text-[var(--color-muted)] hover:text-[var(--color-text)] w-4 h-4 flex items-center justify-center text-sm font-bold transition-opacity"
            onClick={(e) => { e.stopPropagation(); onAction(f); }}
          >
            {actionLabel}
          </button>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status, color }: { status: FileStatus["status"]; color: string }) {
  const labels: Record<FileStatus["status"], string> = {
    modified: "M", added: "A", deleted: "D", renamed: "R", untracked: "?", conflicted: "!",
  };
  return (
    <span className={`text-[10px] font-bold font-mono w-3 shrink-0 ${color}`}>
      {labels[status]}
    </span>
  );
}
