import { useState } from "react";
import { useRepoStore } from "../store/useRepoStore";
import { checkoutBranch, createBranch, deleteBranch, rebaseOnto, getBranches, getCommits, getStatus } from "../ipc/commands";
import { ContextMenu, useContextMenu } from "./ContextMenu";
import type { BranchInfo } from "../types/git";
import type { MenuEntry } from "./ContextMenu";

export function Sidebar() {
  const branches = useRepoStore((s) => s.branches);
  const headBranch = useRepoStore((s) => s.headBranch);
  const repoPath = useRepoStore((s) => s.repoPath);
  const setBranches = useRepoStore((s) => s.setBranches);
  const setCommits = useRepoStore((s) => s.setCommits);
  const setStatus = useRepoStore((s) => s.setStatus);
  const setHeadBranch = useRepoStore((s) => s.setHeadBranch);
  const { menu, open: openMenu, close: closeMenu } = useContextMenu();
  const [error, setError] = useState<string | null>(null);

  const local = branches.filter((b) => !b.is_remote);
  const remote = branches.filter((b) => b.is_remote);

  async function refresh() {
    if (!repoPath) return;
    const [bs, cs, st] = await Promise.all([
      getBranches(repoPath),
      getCommits(repoPath, 500),
      getStatus(repoPath),
    ]);
    setBranches(bs);
    setCommits(cs);
    setStatus(st);
    const head = bs.find((b) => b.is_head);
    if (head) setHeadBranch(head.name);
  }

  async function run(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  function branchMenu(b: BranchInfo): MenuEntry[] {
    if (!repoPath) return [];

    if (b.is_remote) {
      const localName = b.name.replace(/^[^/]+\//, "");
      return [
        {
          label: `Créer branche locale "${localName}"`,
          action: () => run(() => createBranch(repoPath, localName, b.name)),
        },
        {
          label: "Rebase HEAD sur cette branche",
          action: () => run(() => rebaseOnto(repoPath, b.name)),
          disabled: b.is_head,
        },
      ];
    }

    return [
      {
        label: "Checkout",
        action: () => run(() => checkoutBranch(repoPath, b.name)),
        disabled: b.is_head,
      },
      {
        label: "Rebase HEAD sur cette branche",
        action: () => run(() => rebaseOnto(repoPath, b.name)),
        disabled: b.is_head,
      },
      "separator",
      {
        label: `Créer une branche depuis "${b.name}"`,
        action: () => {
          const name = window.prompt("Nom de la nouvelle branche :");
          if (name?.trim()) run(() => createBranch(repoPath, name.trim(), b.name));
        },
      },
      "separator",
      {
        label: "Supprimer",
        danger: true,
        disabled: b.is_head,
        action: () => {
          if (window.confirm(`Supprimer la branche "${b.name}" ?`))
            run(() => deleteBranch(repoPath, b.name));
        },
      },
    ];
  }

  return (
    <aside className="flex flex-col h-full bg-[var(--color-bg-secondary)] border-r border-white/10 text-sm select-none">
      <div className="p-3 border-b border-white/10">
        <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">Dépôt</span>
        {headBranch && (
          <p className="text-xs text-[var(--color-accent)] mt-1 truncate font-mono">⎇ {headBranch}</p>
        )}
        {error && (
          <p className="text-[10px] text-red-400 mt-1 truncate" title={error}>{error}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        <BranchGroup
          title="LOCAL"
          branches={local}
          onContextMenu={(e, b) => openMenu(e, branchMenu(b))}
        />
        {remote.length > 0 && (
          <BranchGroup
            title="DISTANT"
            branches={remote}
            onContextMenu={(e, b) => openMenu(e, branchMenu(b))}
          />
        )}
      </div>

      {menu && <ContextMenu menu={menu} onClose={closeMenu} />}
    </aside>
  );
}

interface BranchGroupProps {
  title: string;
  branches: BranchInfo[];
  onContextMenu: (e: React.MouseEvent, b: BranchInfo) => void;
}

function BranchGroup({ title, branches, onContextMenu }: BranchGroupProps) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        className="w-full flex items-center gap-1 px-3 py-1 text-[10px] font-bold tracking-widest text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{open ? "▾" : "▸"}</span>
        {title}
      </button>

      {open && (
        <ul>
          {branches.map((b) => (
            <li key={b.name}>
              <div
                className={`flex items-center gap-2 px-4 py-[3px] cursor-default truncate ${
                  b.is_head
                    ? "text-[var(--color-accent)]"
                    : "text-[var(--color-text)] hover:bg-white/5"
                }`}
                onContextMenu={(e) => onContextMenu(e, b)}
              >
                <span className="shrink-0 opacity-50">{b.is_remote ? "⟳" : "⎇"}</span>
                <span className="truncate text-xs">{b.name}</span>
                {b.is_head && (
                  <span className="ml-auto text-[10px] opacity-60 shrink-0">HEAD</span>
                )}
              </div>
            </li>
          ))}
          {branches.length === 0 && (
            <li className="px-4 py-1 text-xs text-[var(--color-muted)] italic">aucune</li>
          )}
        </ul>
      )}
    </div>
  );
}
