mod git;
mod window;

use git::{
    open_repo, get_commits, get_branches, get_status, get_diff, init_repo, clone_repo, fetch,
    merge_branch, get_conflict_content, resolve_conflict,
    checkout_branch, create_branch, delete_branch, rebase_onto,
    CommitInfo, BranchInfo, FileStatus, FileDiff, MergeResult, GitError,
};

#[tauri::command]
fn open_repository(path: String) -> Result<serde_json::Value, GitError> {
    let repo = open_repo(&path)?;
    let head = repo.head().ok().and_then(|r| r.shorthand().map(|s| s.to_string()));
    Ok(serde_json::json!({ "head_branch": head }))
}

#[tauri::command]
fn get_commits_cmd(path: String, limit: usize) -> Result<Vec<CommitInfo>, GitError> {
    let repo = open_repo(&path)?;
    get_commits(&repo, limit)
}

#[tauri::command]
fn get_branches_cmd(path: String) -> Result<Vec<BranchInfo>, GitError> {
    let repo = open_repo(&path)?;
    get_branches(&repo)
}

#[tauri::command]
fn get_status_cmd(path: String) -> Result<Vec<FileStatus>, GitError> {
    let repo = open_repo(&path)?;
    get_status(&repo)
}

#[tauri::command]
fn get_diff_cmd(path: String, file_path: String, staged: bool) -> Result<FileDiff, GitError> {
    let repo = open_repo(&path)?;
    get_diff(&repo, &file_path, staged)
}

#[tauri::command]
fn init_repository(path: String) -> Result<(), GitError> {
    init_repo(&path)
}

#[tauri::command]
fn clone_repository(url: String, path: String) -> Result<(), GitError> {
    clone_repo(&url, &path)
}

#[tauri::command]
fn fetch_remote(path: String, remote: String) -> Result<(), GitError> {
    let repo = open_repo(&path)?;
    fetch(&repo, &remote)
}

#[tauri::command]
fn checkout_branch_cmd(path: String, name: String) -> Result<(), GitError> {
    let repo = open_repo(&path)?;
    checkout_branch(&repo, &name)
}

#[tauri::command]
fn create_branch_cmd(path: String, name: String, from_ref: String) -> Result<(), GitError> {
    let repo = open_repo(&path)?;
    create_branch(&repo, &name, &from_ref)
}

#[tauri::command]
fn delete_branch_cmd(path: String, name: String) -> Result<(), GitError> {
    let repo = open_repo(&path)?;
    delete_branch(&repo, &name)
}

#[tauri::command]
fn rebase_onto_cmd(path: String, onto: String) -> Result<(), GitError> {
    let repo = open_repo(&path)?;
    rebase_onto(&repo, &onto)
}

#[tauri::command]
fn open_new_window(app: tauri::AppHandle) -> Result<(), String> {
    window::open_new_window(&app)
}

#[tauri::command]
fn merge_branch_cmd(path: String, branch: String) -> Result<MergeResult, GitError> {
    let repo = open_repo(&path)?;
    merge_branch(&repo, &branch)
}

#[tauri::command]
fn get_conflict_content_cmd(path: String, file_path: String) -> Result<String, GitError> {
    let repo = open_repo(&path)?;
    get_conflict_content(&repo, &file_path)
}

#[tauri::command]
fn resolve_conflict_cmd(path: String, file_path: String, content: String) -> Result<(), GitError> {
    let repo = open_repo(&path)?;
    resolve_conflict(&repo, &file_path, &content)
}

#[tauri::command]
fn stage_file(path: String, file_path: String) -> Result<(), GitError> {
    let repo = open_repo(&path)?;
    let mut index = repo.index()?;
    index.add_path(std::path::Path::new(&file_path))?;
    index.write()?;
    Ok(())
}

#[tauri::command]
fn unstage_file(path: String, file_path: String) -> Result<(), GitError> {
    let repo = open_repo(&path)?;
    let head = repo.head().ok().and_then(|r| r.peel_to_commit().ok());
    if let Some(commit) = head {
        repo.reset_default(Some(commit.as_object()), [&file_path])?;
    } else {
        let mut index = repo.index()?;
        index.remove_path(std::path::Path::new(&file_path))?;
        index.write()?;
    }
    Ok(())
}

#[tauri::command]
fn create_commit(path: String, message: String) -> Result<String, GitError> {
    let repo = open_repo(&path)?;
    let sig = repo.signature()?;
    let mut index = repo.index()?;
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;

    let parent_commits: Vec<git2::Commit> = repo
        .head()
        .ok()
        .and_then(|r| r.peel_to_commit().ok())
        .map(|c| vec![c])
        .unwrap_or_default();

    let parent_refs: Vec<&git2::Commit> = parent_commits.iter().collect();

    let oid = repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &parent_refs)?;
    Ok(oid.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            open_new_window,
            open_repository,
            checkout_branch_cmd,
            create_branch_cmd,
            delete_branch_cmd,
            rebase_onto_cmd,
            get_commits_cmd,
            get_branches_cmd,
            get_status_cmd,
            get_diff_cmd,
            init_repository,
            clone_repository,
            fetch_remote,
            merge_branch_cmd,
            get_conflict_content_cmd,
            resolve_conflict_cmd,
            stage_file,
            unstage_file,
            create_commit,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
