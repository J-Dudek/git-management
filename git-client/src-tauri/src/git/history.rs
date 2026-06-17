    use git2::{Repository, Sort};
use serde::Serialize;
use super::error::GitError;

#[derive(Debug, Serialize, Clone)]
pub struct CommitInfo {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub email: String,
    pub timestamp: i64,
    pub parents: Vec<String>,
    pub refs: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct BranchInfo {
    pub name: String,
    pub is_remote: bool,
    pub target_hash: String,
    pub is_head: bool,
}

pub fn get_commits(repo: &Repository, limit: usize) -> Result<Vec<CommitInfo>, GitError> {
    let mut walk = repo.revwalk()?;
    walk.push_head().unwrap_or(());
    walk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME)?;

    let refs = collect_refs(repo);

    let commits = walk
        .take(limit)
        .filter_map(|oid| oid.ok())
        .filter_map(|oid| repo.find_commit(oid).ok())
        .map(|commit| {
            let hash = commit.id().to_string();
            let commit_refs = refs.get(&hash).cloned().unwrap_or_default();
            CommitInfo {
                short_hash: hash[..7].to_string(),
                message: commit.summary().unwrap_or("").to_string(),
                author: commit.author().name().unwrap_or("").to_string(),
                email: commit.author().email().unwrap_or("").to_string(),
                timestamp: commit.time().seconds(),
                parents: commit.parent_ids().map(|id| id.to_string()).collect(),
                refs: commit_refs,
                hash,
            }
        })
        .collect();

    Ok(commits)
}

pub fn get_branches(repo: &Repository) -> Result<Vec<BranchInfo>, GitError> {
    let head_oid = repo.head().ok().and_then(|r| r.target());

    let branches = repo
        .branches(None)?
        .filter_map(|b| b.ok())
        .filter_map(|(branch, branch_type)| {
            let name = branch.name().ok()??.to_string();
            let target = branch.get().target()?;
            Some(BranchInfo {
                name,
                is_remote: branch_type == git2::BranchType::Remote,
                target_hash: target.to_string(),
                is_head: Some(target) == head_oid,
            })
        })
        .collect();

    Ok(branches)
}

fn collect_refs(repo: &Repository) -> std::collections::HashMap<String, Vec<String>> {
    let mut map: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();

    if let Ok(refs) = repo.references() {
        for r in refs.filter_map(|r| r.ok()) {
            if let (Some(name), Some(target)) = (r.shorthand(), r.target()) {
                map.entry(target.to_string()).or_default().push(name.to_string());
            }
        }
    }

    map
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn make_repo_with_commits() -> (TempDir, Repository) {
        let dir = TempDir::new().unwrap();
        let repo = Repository::init(dir.path()).unwrap();

        let mut config = repo.config().unwrap();
        config.set_str("user.name", "Test").unwrap();
        config.set_str("user.email", "test@test.com").unwrap();

        let sig = git2::Signature::now("Test", "test@test.com").unwrap();
        {
            let tree_id = {
                let mut index = repo.index().unwrap();
                index.write_tree().unwrap()
            };
            let tree = repo.find_tree(tree_id).unwrap();
            repo.commit(Some("HEAD"), &sig, &sig, "initial commit", &tree, &[])
                .unwrap();
        }

        (dir, repo)
    }

    #[test]
    fn get_commits_empty_repo() {
        let dir = TempDir::new().unwrap();
        let repo = Repository::init(dir.path()).unwrap();
        let result = get_commits(&repo, 100);
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }

    #[test]
    fn get_commits_returns_commits() {
        let (_dir, repo) = make_repo_with_commits();
        let commits = get_commits(&repo, 100).unwrap();
        assert_eq!(commits.len(), 1);
        assert_eq!(commits[0].message, "initial commit");
        assert_eq!(commits[0].short_hash.len(), 7);
    }

    #[test]
    fn get_commits_respects_limit() {
        let (_dir, repo) = make_repo_with_commits();
        let commits = get_commits(&repo, 0).unwrap();
        assert!(commits.is_empty());
    }

    #[test]
    fn get_branches_returns_head_branch() {
        let (_dir, repo) = make_repo_with_commits();
        let branches = get_branches(&repo).unwrap();
        assert!(!branches.is_empty());
        let head = branches.iter().find(|b| b.is_head);
        assert!(head.is_some());
    }
}
