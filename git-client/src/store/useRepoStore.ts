import { create } from "zustand";
import type {
  BranchInfo, CommitInfo, FileStatus, LfsStatus, RemoteInfo, RepoInfo, StashInfo, SubmoduleInfo, TagInfo,
} from "../types/git";
import {
  getBranches, getCommits, getRepoInfo, getStatus, getTags, lfsStatus, listRemotes, listStashes, listSubmodules, openRepository,
} from "../ipc/commands";

/** Ce qu'affiche la zone centrale : le graphe, un diff ou l'éditeur de conflit. */
export type CenterView =
  | { kind: "graph" }
  | { kind: "diff"; path: string; source: { type: "workdir"; staged: boolean } | { type: "commit"; hash: string } }
  | { kind: "conflict"; path: string };

const RECENT_KEY = "git-client.recent-repos";
const MAX_RECENT = 10;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // stockage indisponible : la liste reste en mémoire
  }
}

interface RepoStore {
  repoPath: string | null;
  info: RepoInfo | null;
  commits: CommitInfo[];
  branches: BranchInfo[];
  tags: TagInfo[];
  stashes: StashInfo[];
  remotes: RemoteInfo[];
  submodules: SubmoduleInfo[];
  lfs: LfsStatus | null;
  status: FileStatus[];
  selectedCommit: CommitInfo | null;
  searchQuery: string;
  center: CenterView;
  recentRepos: string[];

  openRepo: (path: string) => Promise<void>;
  closeRepo: () => void;
  refresh: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  setSelectedCommit: (commit: CommitInfo | null) => void;
  setSearchQuery: (q: string) => void;
  setCenter: (view: CenterView) => void;
  forgetRecent: (path: string) => void;
}

const emptyRepo = {
  repoPath: null,
  info: null,
  commits: [],
  branches: [],
  tags: [],
  stashes: [],
  remotes: [],
  submodules: [],
  lfs: null,
  status: [],
  selectedCommit: null,
  searchQuery: "",
  center: { kind: "graph" } as CenterView,
};

export const useRepoStore = create<RepoStore>((set, get) => ({
  ...emptyRepo,
  recentRepos: loadRecent(),

  openRepo: async (path) => {
    const info = await openRepository(path);
    const recentRepos = [info.path, ...get().recentRepos.filter((p) => p !== info.path)].slice(0, MAX_RECENT);
    saveRecent(recentRepos);
    set({ ...emptyRepo, repoPath: info.path, info, recentRepos });
    await get().refresh();
  },

  closeRepo: () => set(emptyRepo),

  refresh: async () => {
    const path = get().repoPath;
    if (!path) return;
    const [info, commits, branches, tags, stashes, remotes, submodules, lfs, status] = await Promise.all([
      getRepoInfo(path),
      getCommits(path),
      getBranches(path),
      getTags(path),
      listStashes(path),
      listRemotes(path),
      listSubmodules(path),
      lfsStatus(path).catch(() => null),
      getStatus(path),
    ]);
    if (get().repoPath !== path) return; // un autre dépôt a été ouvert entre-temps
    const selected = get().selectedCommit;
    set({
      info, commits, branches, tags, stashes, remotes, submodules, lfs, status,
      selectedCommit: selected ? commits.find((c) => c.hash === selected.hash) ?? null : null,
    });
  },

  refreshStatus: async () => {
    const path = get().repoPath;
    if (!path) return;
    const [info, status] = await Promise.all([getRepoInfo(path), getStatus(path)]);
    if (get().repoPath === path) set({ info, status });
  },

  setSelectedCommit: (selectedCommit) => set({ selectedCommit }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setCenter: (center) => set({ center }),

  forgetRecent: (path) => {
    const recentRepos = get().recentRepos.filter((p) => p !== path);
    saveRecent(recentRepos);
    set({ recentRepos });
  },
}));
