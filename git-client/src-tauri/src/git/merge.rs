use git2::{MergeOptions, Repository};
use serde::Serialize;
use super::error::GitError;

#[derive(Debug, Serialize)]
pub struct MergeResult {
    pub conflicted_files: Vec<String>,
    pub success: bool,
}

pub fn merge_branch(repo: &Repository, branch_name: &str) -> Result<MergeResult, GitError> {
    let branch = repo.find_branch(branch_name, git2::BranchType::Local)?;
    let branch_commit = branch.get().peel_to_commit()?;
    let annotated = repo.find_annotated_commit(branch_commit.id())?;

    let analysis = repo.merge_analysis(&[&annotated])?;

    if analysis.0.is_up_to_date() {
        return Ok(MergeResult { conflicted_files: vec![], success: true });
    }

    if analysis.0.is_fast_forward() {
        let mut reference = repo.head()?;
        reference.set_target(branch_commit.id(), "fast-forward")?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))?;
        return Ok(MergeResult { conflicted_files: vec![], success: true });
    }

    let mut merge_opts = MergeOptions::new();
    merge_opts.fail_on_conflict(false);
    repo.merge(&[&annotated], Some(&mut merge_opts), None)?;

    let index = repo.index()?;
    let conflicted: Vec<String> = index
        .conflicts()?
        .filter_map(|c| c.ok())
        .filter_map(|c| c.our.or(c.their).or(c.ancestor))
        .filter_map(|e| String::from_utf8(e.path).ok())
        .collect();

    let success = conflicted.is_empty();
    Ok(MergeResult { conflicted_files: conflicted, success })
}

pub fn get_conflict_content(repo: &Repository, file_path: &str) -> Result<String, GitError> {
    let workdir = repo.workdir().ok_or_else(|| GitError::NotFound("bare repository".into()))?;
    let full_path = workdir.join(file_path);
    std::fs::read_to_string(&full_path)
        .map_err(|e| GitError::NotFound(e.to_string()))
}

pub fn resolve_conflict(repo: &Repository, file_path: &str, content: &str) -> Result<(), GitError> {
    let workdir = repo.workdir().ok_or_else(|| GitError::NotFound("bare repository".into()))?;
    std::fs::write(workdir.join(file_path), content)
        .map_err(|e| GitError::NotFound(e.to_string()))?;

    let mut index = repo.index()?;
    index.add_path(std::path::Path::new(file_path))?;
    index.write()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;
    use git2::{Repository, Signature};

    fn base_repo() -> (TempDir, Repository) {
        let dir = TempDir::new().unwrap();
        let repo = Repository::init(dir.path()).unwrap();
        let mut cfg = repo.config().unwrap();
        cfg.set_str("user.name", "Test").unwrap();
        cfg.set_str("user.email", "test@test.com").unwrap();

        fs::write(dir.path().join("file.txt"), "line1\nline2\n").unwrap();
        let sig = Signature::now("Test", "test@test.com").unwrap();
        {
            let mut index = repo.index().unwrap();
            index.add_path(std::path::Path::new("file.txt")).unwrap();
            index.write().unwrap();
            let tree_id = index.write_tree().unwrap();
            let tree = repo.find_tree(tree_id).unwrap();
            repo.commit(Some("HEAD"), &sig, &sig, "initial", &tree, &[]).unwrap();
        }
        (dir, repo)
    }

    #[test]
    fn merge_up_to_date_branch_succeeds() {
        let (_dir, repo) = base_repo();
        // Create a branch pointing to HEAD
        let head = repo.head().unwrap().peel_to_commit().unwrap();
        repo.branch("feature", &head, false).unwrap();

        // Checkout feature, add commit, come back
        repo.set_head("refs/heads/feature").unwrap();
        repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force())).unwrap();
        repo.set_head("refs/heads/master").unwrap();
        repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force())).unwrap();

        let result = merge_branch(&repo, "feature").unwrap();
        assert!(result.success);
        assert!(result.conflicted_files.is_empty());
    }

    #[test]
    fn resolve_conflict_writes_and_stages_file() {
        let (dir, repo) = base_repo();
        let file = dir.path().join("new.txt");
        fs::write(&file, "resolved content\n").unwrap();

        {
            let mut index = repo.index().unwrap();
            index.add_path(std::path::Path::new("new.txt")).unwrap();
            index.write().unwrap();
        }

        resolve_conflict(&repo, "new.txt", "final content\n").unwrap();
        let content = fs::read_to_string(&file).unwrap();
        assert_eq!(content, "final content\n");
    }

    #[test]
    fn get_conflict_content_reads_file() {
        let (dir, repo) = base_repo();
        fs::write(dir.path().join("file.txt"), "conflict\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\n").unwrap();
        let content = get_conflict_content(&repo, "file.txt").unwrap();
        assert!(content.contains("<<<<<<<"));
    }
}
