import { create } from "zustand";
import type { BranchInfo, CommitInfo, FileStatus } from "../types/git";

interface RepoStore {
  repoPath: string | null;
  headBranch: string | null;
  commits: CommitInfo[];
  branches: BranchInfo[];
  status: FileStatus[];
  selectedCommit: CommitInfo | null;
  searchQuery: string;

  setRepoPath: (path: string) => void;
  setCommits: (commits: CommitInfo[]) => void;
  setBranches: (branches: BranchInfo[]) => void;
  setStatus: (status: FileStatus[]) => void;
  setHeadBranch: (branch: string | null) => void;
  setSelectedCommit: (commit: CommitInfo | null) => void;
  setSearchQuery: (q: string) => void;
  reset: () => void;
}

const initialState = {
  repoPath: null,
  headBranch: null,
  commits: [],
  branches: [],
  status: [],
  selectedCommit: null,
  searchQuery: "",
};

export const useRepoStore = create<RepoStore>((set) => ({
  ...initialState,

  setRepoPath: (path) => set({ repoPath: path }),
  setCommits: (commits) => set({ commits }),
  setBranches: (branches) => set({ branches }),
  setStatus: (status) => set({ status }),
  setHeadBranch: (headBranch) => set({ headBranch }),
  setSelectedCommit: (selectedCommit) => set({ selectedCommit }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  reset: () => set(initialState),
}));
