import { invoke } from "@tauri-apps/api/core";
import type { BranchInfo, CommitInfo, FileStatus, FileDiff } from "../types/git";

export async function openRepository(path: string): Promise<{ head_branch: string | null }> {
  return invoke("open_repository", { path });
}

export async function getCommits(path: string, limit = 500): Promise<CommitInfo[]> {
  return invoke("get_commits_cmd", { path, limit });
}

export async function getBranches(path: string): Promise<BranchInfo[]> {
  return invoke("get_branches_cmd", { path });
}

export async function getStatus(path: string): Promise<FileStatus[]> {
  return invoke("get_status_cmd", { path });
}

export async function getDiff(path: string, filePath: string, staged: boolean): Promise<FileDiff> {
  return invoke("get_diff_cmd", { path, filePath, staged });
}

export async function initRepository(path: string): Promise<void> {
  return invoke("init_repository", { path });
}

export async function cloneRepository(url: string, path: string): Promise<void> {
  return invoke("clone_repository", { url, path });
}

export async function fetchRemote(path: string, remote = "origin"): Promise<void> {
  return invoke("fetch_remote", { path, remote });
}

export async function mergeBranch(path: string, branch: string): Promise<{ conflicted_files: string[]; success: boolean }> {
  return invoke("merge_branch_cmd", { path, branch });
}

export async function openNewWindow(): Promise<void> {
  return invoke("open_new_window");
}

export async function checkoutBranch(path: string, name: string): Promise<void> {
  return invoke("checkout_branch_cmd", { path, name });
}

export async function createBranch(path: string, name: string, fromRef: string): Promise<void> {
  return invoke("create_branch_cmd", { path, name, fromRef });
}

export async function deleteBranch(path: string, name: string): Promise<void> {
  return invoke("delete_branch_cmd", { path, name });
}

export async function rebaseOnto(path: string, onto: string): Promise<void> {
  return invoke("rebase_onto_cmd", { path, onto });
}

export async function stageFile(path: string, filePath: string): Promise<void> {
  return invoke("stage_file", { path, filePath });
}

export async function unstageFile(path: string, filePath: string): Promise<void> {
  return invoke("unstage_file", { path, filePath });
}

export async function createCommit(path: string, message: string): Promise<string> {
  return invoke("create_commit", { path, message });
}
