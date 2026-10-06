import { useRef, useState, useEffect, useMemo } from "react";
import { useRepoStore } from "../store/useRepoStore";
import { useUiStore, confirmAction } from "../store/useUiStore";
import { computeGraphLayout } from "./layout";
import { filterCommits } from "../search/filterCommits";
import { GraphCanvas, H_PADDING, LANE_WIDTH, ROW_HEIGHT } from "./GraphCanvas";
import { ContextMenu, useContextMenu, type MenuEntry } from "../components/ContextMenu";
import {
  checkoutCommit, cherryPick, createBranch, createTag, mergeBranch, rebaseOnto, resetTo, revertCommit,
} from "../ipc/commands";
import { reportMerge, runGit } from "../lib/actions";
import { localOnlyBranches } from "../lib/branches";
import type { CommitInfo, RefLabel } from "../types/git";

const INFO_OFFSET = 20;
const OVERSCAN = 10;

export function CommitGraph() {
  const commits = useRepoStore((s) => s.commits);
  const status = useRepoStore((s) => s.status);
  const info = useRepoStore((s) => s.info);
  const searchQuery = useRepoStore((s) => s.searchQuery);
  const selectedCommit = useRepoStore((s) => s.selectedCommit);
  const setSelectedCommit = useRepoStore((s) => s.setSelectedCommit);
  const repoPath = useRepoStore((s) => s.repoPath);
  const branches = useRepoStore((s) => s.branches);
  const localOnly = useMemo(() => localOnlyBranches(branches), [branches]);
  const visibleCommits = useMemo(() => filterCommits(commits, searchQuery), [commits, searchQuery]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 400, height: 400 });
  const [scrollTop, setScrollTop] = useState(0);
  const { menu, open: openMenu, close: closeMenu } = useContextMenu();

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [visibleCommits.length > 0]);

  const layout = useMemo(() => computeGraphLayout(visibleCommits), [visibleCommits]);
  const graphWidth = H_PADDING * 2 + layout.laneCount * LANE_WIDTH + INFO_OFFSET;

  // Fait défiler jusqu'au commit sélectionné (ex. clic sur une branche dans la barre latérale).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !selectedCommit) return;
    const row = layout.nodes.findIndex((n) => n.commit.hash === selectedCommit.hash);
    if (row === -1) return;
    const top = row * ROW_HEIGHT;
    if (top < el.scrollTop || top + ROW_HEIGHT > el.scrollTop + el.clientHeight) {
      el.scrollTop = Math.max(0, top - el.clientHeight / 3);
    }
  }, [selectedCommit, layout]);

  function commitMenu(commit: CommitInfo): MenuEntry[] {
    if (!repoPath) return [];
    const path = repoPath;
    const head = info?.head_branch ?? "HEAD";
    const ask = useUiStore.getState().ask;
    const isMerge = commit.parents.length > 1;

    const reset = (mode: "soft" | "mixed" | "hard") => async () => {
      const descriptions = {
        soft: "Les modifications des commits annulés restent indexées.",
        mixed: "Les modifications des commits annulés restent dans la copie de travail (non indexées).",
        hard: "Toutes les modifications locales et les commits suivants seront perdus.",
      };
      if (await confirmAction(`Reset ${mode} de ${head} sur ${commit.short_hash} ?`, descriptions[mode], mode === "hard"))
        await runGit(() => resetTo(path, commit.hash, mode));
    };

    return [
      {
        label: "Checkout ce commit (HEAD détaché)",
        action: () => runGit(() => checkoutCommit(path, commit.hash)),
      },
      {
        label: "Créer une branche ici…",
        action: async () => {
          const result = await ask({
            title: "Nouvelle branche",
            message: `Depuis ${commit.short_hash} — ${commit.message}`,
            input: { placeholder: "nom-de-branche" },
            checkbox: { label: "Basculer sur la nouvelle branche", initial: true },
            confirmLabel: "Créer",
          });
          const name = result?.value.trim();
          if (name) await runGit(() => createBranch(path, name, commit.hash, result!.checked), { success: `Branche ${name} créée` });
        },
      },
      {
        label: "Créer un tag ici…",
        action: async () => {
          const name = await useUiStore.getState().ask({ title: "Nouveau tag", input: { placeholder: "v1.0.0" }, confirmLabel: "Suivant" });
          const tag = name?.value.trim();
          if (!tag) return;
          const msg = await ask({
            title: `Tag ${tag}`,
            message: "Un message crée un tag annoté ; laisse vide pour un tag léger.",
            input: { placeholder: "Message (optionnel)", multiline: true },
            confirmLabel: "Créer le tag",
          });
          if (msg) await runGit(() => createTag(path, tag, commit.hash, msg.value.trim() || null), { success: `Tag ${tag} créé` });
        },
      },
      "separator",
      {
        label: `Cherry-pick dans ${head}`,
        disabled: isMerge,
        action: async () => reportMerge(await runGit(() => cherryPick(path, commit.hash)), "Cherry-pick terminé"),
      },
      {
        label: "Revert ce commit",
        disabled: isMerge,
        action: async () => reportMerge(await runGit(() => revertCommit(path, commit.hash)), "Revert terminé"),
      },
      {
        label: `Merger ce commit dans ${head}`,
        action: async () => reportMerge(await runGit(() => mergeBranch(path, commit.hash)), "Merge terminé"),
      },
      {
        label: `Rebase interactif de ${head} depuis ce commit…`,
        disabled: commit.hash === info?.head_hash,
        action: () => useUiStore.getState().setInteractiveRebaseBase(commit.hash),
      },
      {
        label: `Rebaser ${head} sur ce commit`,
        action: async () => {
          if (await confirmAction(`Rebaser ${head} sur ${commit.short_hash} ?`, "Les commits de la branche courante seront réécrits."))
            reportMerge(await runGit(() => rebaseOnto(path, commit.hash)), "Rebase terminé");
        },
      },
      "separator",
      { label: `Reset ${head} ici — soft`, action: reset("soft") },
      { label: `Reset ${head} ici — mixed`, action: reset("mixed") },
      { label: `Reset ${head} ici — hard`, action: reset("hard"), danger: true },
      "separator",
      { label: "Copier le hash complet", action: () => navigator.clipboard.writeText(commit.hash) },
      { label: "Copier le hash court", action: () => navigator.clipboard.writeText(commit.short_hash) },
      { label: "Copier le message", action: () => navigator.clipboard.writeText(commit.message) },
    ];
  }

  const wipRow = status.length > 0 && (
    <button
      className={`flex items-center gap-2 w-full shrink-0 px-3 h-7 text-xs border-b border-white/10 ${
        selectedCommit ? "hover:bg-white/5 text-[var(--color-muted)]" : "bg-white/10 text-[var(--color-text)]"
      }`}
      onClick={() => setSelectedCommit(null)}
      title="Afficher les modifications en cours"
    >
      <span className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-[var(--color-accent)]" />
      <span className="italic">// WIP</span>
      <span className="text-[var(--color-muted)]">
        {status.length} fichier{status.length > 1 ? "s" : ""} modifié{status.length > 1 ? "s" : ""}
      </span>
    </button>
  );

  if (commits.length === 0) {
    return (
      <div className="flex flex-col h-full">
        {wipRow}
        <div className="flex-1 flex items-center justify-center text-[var(--color-muted)] text-sm">
          Aucun commit pour l'instant — indexe des fichiers et crée le premier commit
        </div>
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

  const firstRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const lastRow = Math.min(layout.nodes.length, Math.ceil((scrollTop + size.height) / ROW_HEIGHT) + OVERSCAN);

  return (
    <div className="flex flex-col h-full">
      {wipRow}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-y-auto overflow-x-hidden select-none"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div className="relative" style={{ height: visibleCommits.length * ROW_HEIGHT }}>
          <GraphCanvas
            layout={layout}
            selectedHash={selectedCommit?.hash ?? null}
            headHash={info?.head_hash ?? null}
            onSelectRow={(row) => setSelectedCommit(layout.nodes[row]?.commit ?? null)}
            width={graphWidth}
            scrollTop={scrollTop}
            viewportHeight={size.height}
          />

          {layout.nodes.slice(firstRow, lastRow).map((node) => (
            <CommitRow
              key={node.commit.hash}
              commit={node.commit}
              row={node.row}
              graphWidth={graphWidth}
              isSelected={node.commit.hash === selectedCommit?.hash}
              containerWidth={size.width}
              localOnly={localOnly}
              onClick={() => setSelectedCommit(node.commit)}
              onContextMenu={(e) => {
                setSelectedCommit(node.commit);
                openMenu(e, commitMenu(node.commit));
              }}
            />
          ))}
        </div>

        {menu && <ContextMenu menu={menu} onClose={closeMenu} />}
      </div>
    </div>
  );
}

interface CommitRowProps {
  commit: CommitInfo;
  row: number;
  graphWidth: number;
  isSelected: boolean;
  containerWidth: number;
  localOnly: Set<string>;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function CommitRow({ commit, row, graphWidth, isSelected, containerWidth, localOnly, onClick, onContextMenu }: CommitRowProps) {
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
        width: Math.max(containerWidth - graphWidth, 0),
        height: ROW_HEIGHT,
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {commit.refs.length > 0 && (
        <div className="flex gap-1 shrink-0 max-w-[45%] overflow-hidden">
          {commit.refs.slice(0, 4).map((ref) => <RefBadge
              key={`${ref.kind}:${ref.name}`}
              label={ref}
              localOnly={(ref.kind === "head" || ref.kind === "local") && localOnly.has(ref.name)}
            />)}
          {commit.refs.length > 4 && <span className="text-[10px] text-[var(--color-muted)]">+{commit.refs.length - 4}</span>}
        </div>
      )}
      <span className="text-xs text-[var(--color-text)] truncate flex-1">{commit.message}</span>
      <span className="text-[11px] text-[var(--color-muted)] shrink-0 max-w-32 truncate">{commit.author}</span>
      <span className="text-[11px] text-[var(--color-muted)] shrink-0 font-mono">{commit.short_hash}</span>
      <span className="text-[11px] text-[var(--color-muted)] shrink-0 w-24 text-right">{date}</span>
    </div>
  );
}

const REF_STYLES: Record<RefLabel["kind"], string> = {
  head: "bg-[var(--color-accent)] text-white border-[var(--color-accent)]",
  local: "bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/40",
  remote: "bg-sky-500/15 text-sky-300 border-sky-400/40",
  tag: "bg-amber-500/15 text-amber-300 border-amber-400/40",
};

const REF_ICONS: Record<RefLabel["kind"], string> = { head: "⎇", local: "⎇", remote: "☁", tag: "⌂" };

function RefBadge({ label, localOnly }: { label: RefLabel; localOnly: boolean }) {
  const title = label.kind === "head" ? `${label.name} (branche courante)` : label.name;
  return (
    <span
      className={`px-1 text-[10px] rounded font-mono border whitespace-nowrap ${REF_STYLES[label.kind]} ${localOnly ? "border-dashed" : ""}`}
      title={localOnly ? `${title} — uniquement en local, absente des remotes` : title}
    >
      {REF_ICONS[label.kind]} {label.name}
      {localOnly && <span className="ml-1 opacity-70 italic">local</span>}
    </span>
  );
}
