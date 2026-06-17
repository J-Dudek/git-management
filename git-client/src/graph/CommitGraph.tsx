import { useRef, useState, useEffect, useMemo } from "react";
import { useRepoStore } from "../store/useRepoStore";
import { computeGraphLayout } from "./layout";
import { filterCommits } from "../search/filterCommits";
import { GraphCanvas } from "./GraphCanvas";
import { ContextMenu, useContextMenu } from "../components/ContextMenu";
import { createBranch, rebaseOnto, getBranches, getCommits } from "../ipc/commands";
import type { CommitInfo } from "../types/git";

const ROW_HEIGHT = 28;
const LANE_WIDTH = 16;
const H_PADDING = 10;
const INFO_OFFSET = 20;

export function CommitGraph() {
  const commits = useRepoStore((s) => s.commits);
  const searchQuery = useRepoStore((s) => s.searchQuery);
  const selectedCommit = useRepoStore((s) => s.selectedCommit);
  const setSelectedCommit = useRepoStore((s) => s.setSelectedCommit);
  const repoPath = useRepoStore((s) => s.repoPath);
  const setCommits = useRepoStore((s) => s.setCommits);
  const setBranches = useRepoStore((s) => s.setBranches);
  const visibleCommits = useMemo(() => filterCommits(commits, searchQuery), [commits, searchQuery]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(400);
  const { menu, open: openMenu, close: closeMenu } = useContextMenu();

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const layout = useMemo(() => computeGraphLayout(visibleCommits), [visibleCommits]);
  const graphWidth = H_PADDING * 2 + layout.laneCount * LANE_WIDTH + INFO_OFFSET;

  async function refresh() {
    if (!repoPath) return;
    const [cs, bs] = await Promise.all([getCommits(repoPath, 500), getBranches(repoPath)]);
    setCommits(cs);
    setBranches(bs);
  }

  function handleSelectRow(row: number) {
    setSelectedCommit(layout.nodes[row]?.commit ?? null);
  }

  function commitMenu(commit: CommitInfo) {
    if (!repoPath) return [];
    return [
      {
        label: "Créer une branche ici",
        action: () => {
          const name = window.prompt("Nom de la nouvelle branche :");
          if (name?.trim())
            createBranch(repoPath, name.trim(), commit.hash).then(refresh);
        },
      },
      {
        label: "Rebase HEAD sur ce commit",
        action: () => {
          if (window.confirm(`Rebase HEAD sur ${commit.short_hash} ?`))
            createBranch(repoPath, `__tmp_rebase_${commit.short_hash}`, commit.hash)
              .then(() => rebaseOnto(repoPath, `__tmp_rebase_${commit.short_hash}`))
              .then(refresh);
        },
      },
      "separator" as const,
      {
        label: "Copier le hash complet",
        action: () => navigator.clipboard.writeText(commit.hash),
      },
      {
        label: "Copier le hash court",
        action: () => navigator.clipboard.writeText(commit.short_hash),
      },
    ];
  }

  if (commits.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-muted)] text-sm">
        Aucun commit — ouvre un dépôt
      </div>
    );
  }

  if (visibleCommits.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-muted)] text-sm">
        Aucun commit correspondant à la recherche
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-auto select-none">
      <div className="relative" style={{ width: containerWidth, height: visibleCommits.length * ROW_HEIGHT }}>
        <div className="absolute top-0 left-0">
          <GraphCanvas
            layout={layout}
            selectedHash={selectedCommit?.hash ?? null}
            onSelectRow={handleSelectRow}
            width={graphWidth}
          />
        </div>

        {layout.nodes.map((node) => {
          const isSelected = node.commit.hash === selectedCommit?.hash;
          return (
            <CommitRow
              key={node.commit.hash}
              commit={node.commit}
              row={node.row}
              graphWidth={graphWidth}
              isSelected={isSelected}
              containerWidth={containerWidth}
              onClick={() => setSelectedCommit(node.commit)}
              onContextMenu={(e) => {
                setSelectedCommit(node.commit);
                openMenu(e, commitMenu(node.commit));
              }}
            />
          );
        })}
      </div>

      {menu && <ContextMenu menu={menu} onClose={closeMenu} />}
    </div>
  );
}

interface CommitRowProps {
  commit: CommitInfo;
  row: number;
  graphWidth: number;
  isSelected: boolean;
  containerWidth: number;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function CommitRow({ commit, row, graphWidth, isSelected, containerWidth, onClick, onContextMenu }: CommitRowProps) {
  const date = new Date(commit.timestamp * 1000).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div
      className={`absolute flex items-center gap-3 px-2 cursor-pointer transition-colors duration-100 ${
        isSelected ? "bg-white/10" : "hover:bg-white/5"
      }`}
      style={{
        top: row * ROW_HEIGHT,
        left: graphWidth,
        width: containerWidth - graphWidth,
        height: ROW_HEIGHT,
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {commit.refs.length > 0 && (
        <div className="flex gap-1 shrink-0">
          {commit.refs.slice(0, 3).map((ref) => (
            <span
              key={ref}
              className="px-1 py-0 text-[10px] rounded font-mono bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/30"
            >
              {ref}
            </span>
          ))}
        </div>
      )}
      <span className="text-xs text-[var(--color-text)] truncate flex-1">{commit.message}</span>
      <span className="text-[11px] text-[var(--color-muted)] shrink-0">{commit.author}</span>
      <span className="text-[11px] text-[var(--color-muted)] shrink-0 font-mono">{commit.short_hash}</span>
      <span className="text-[11px] text-[var(--color-muted)] shrink-0">{date}</span>
    </div>
  );
}
