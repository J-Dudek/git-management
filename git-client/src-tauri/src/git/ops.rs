use git2::{BranchType, build::CheckoutBuilder, Repository};
use super::error::GitError;

pub fn checkout_branch(repo: &Repository, name: &str) -> Result<(), GitError> {
    let branch = repo.find_branch(name, BranchType::Local)?;
    let ref_name = branch
        .get()
        .name()
        .ok_or_else(|| GitError::NotFound("ref invalide".into()))?
        .to_string();
    repo.set_head(&ref_name)?;
    repo.checkout_head(Some(CheckoutBuilder::default().safe()))?;
    Ok(())
}

pub fn create_branch(repo: &Repository, name: &str, from_ref: &str) -> Result<(), GitError> {
    let obj = repo.revparse_single(from_ref)?;
    let commit = obj.peel_to_commit()?;
    repo.branch(name, &commit, false)?;
    Ok(())
}

pub fn delete_branch(repo: &Repository, name: &str) -> Result<(), GitError> {
    let mut branch = repo.find_branch(name, BranchType::Local)?;
    branch.delete()?;
    Ok(())
}

pub fn rebase_onto(repo: &Repository, onto_name: &str) -> Result<(), GitError> {
    let onto_commit = repo
        .find_branch(onto_name, BranchType::Local)?
        .get()
        .peel_to_commit()?;
    let onto = repo.find_annotated_commit(onto_commit.id())?;

    let mut rebase = repo.rebase(None, None, Some(&onto), None)?;
    let sig = repo.signature()?;

    loop {
        match rebase.next() {
            None => break,
            Some(Err(e)) => {
                let _ = rebase.abort();
                return Err(e.into());
            }
            Some(Ok(_)) => {
                if repo.index()?.has_conflicts() {
                    rebase.abort()?;
                    return Err(GitError::Conflict(
                        "Conflits détectés pendant le rebase".into(),
                    ));
                }
                rebase.commit(None, &sig, None)?;
            }
        }
    }
    rebase.finish(None)?;
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

        fs::write(dir.path().join("file.txt"), "v1\n").unwrap();
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

    fn add_commit(repo: &Repository, dir: &TempDir, filename: &str, content: &str, message: &str) {
        fs::write(dir.path().join(filename), content).unwrap();
        let sig = Signature::now("Test", "test@test.com").unwrap();
        let parent = repo.head().unwrap().peel_to_commit().unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new(filename)).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &[&parent]).unwrap();
    }

    #[test]
    fn checkout_switches_head() {
        let (dir, repo) = base_repo();
        let head = repo.head().unwrap().peel_to_commit().unwrap();
        repo.branch("feature", &head, false).unwrap();

        checkout_branch(&repo, "feature").unwrap();

        let current = repo.head().unwrap();
        assert_eq!(current.shorthand().unwrap(), "feature");
    }

    #[test]
    fn checkout_nonexistent_branch_returns_error() {
        let (_dir, repo) = base_repo();
        assert!(checkout_branch(&repo, "does-not-exist").is_err());
    }

    #[test]
    fn create_branch_from_head() {
        let (_dir, repo) = base_repo();
        create_branch(&repo, "new-branch", "HEAD").unwrap();
        assert!(repo.find_branch("new-branch", BranchType::Local).is_ok());
    }

    #[test]
    fn create_branch_from_commit_hash() {
        let (_dir, repo) = base_repo();
        let hash = repo.head().unwrap().target().unwrap().to_string();
        create_branch(&repo, "from-hash", &hash).unwrap();
        assert!(repo.find_branch("from-hash", BranchType::Local).is_ok());
    }

    #[test]
    fn create_branch_duplicate_returns_error() {
        let (_dir, repo) = base_repo();
        create_branch(&repo, "dup", "HEAD").unwrap();
        assert!(create_branch(&repo, "dup", "HEAD").is_err());
    }

    #[test]
    fn delete_branch_removes_it() {
        let (_dir, repo) = base_repo();
        let head = repo.head().unwrap().peel_to_commit().unwrap();
        repo.branch("to-delete", &head, false).unwrap();

        delete_branch(&repo, "to-delete").unwrap();

        assert!(repo.find_branch("to-delete", BranchType::Local).is_err());
    }

    #[test]
    fn delete_nonexistent_branch_returns_error() {
        let (_dir, repo) = base_repo();
        assert!(delete_branch(&repo, "ghost").is_err());
    }

    #[test]
    fn rebase_onto_linear_history() {
        let (dir, repo) = base_repo();

        // main: A -- B
        // feature branché sur A, on veut rebase feature sur B (main)
        let head_a = repo.head().unwrap().peel_to_commit().unwrap();
        repo.branch("feature", &head_a, false).unwrap();

        // Ajoute un commit sur main
        add_commit(&repo, &dir, "main.txt", "main work\n", "commit on main");

        // Checkout feature
        repo.set_head("refs/heads/feature").unwrap();
        repo.checkout_head(Some(CheckoutBuilder::default().force())).unwrap();

        // Ajoute un commit sur feature
        add_commit(&repo, &dir, "feat.txt", "feature work\n", "commit on feature");

        // Rebase feature onto main
        rebase_onto(&repo, "master").unwrap();

        // La branche feature doit avoir main comme ancêtre direct
        let feature_commit = repo.head().unwrap().peel_to_commit().unwrap();
        let parent = feature_commit.parent(0).unwrap();
        let main_commit = repo.find_branch("master", BranchType::Local).unwrap()
            .get().peel_to_commit().unwrap();
        assert_eq!(parent.id(), main_commit.id());
    }
}
