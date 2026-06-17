use git2::Repository;
use super::error::GitError;

pub fn open_repo(path: &str) -> Result<Repository, GitError> {
    Repository::open(path).map_err(|_| GitError::NotFound(path.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn init_test_repo() -> (TempDir, git2::Repository) {
        let dir = TempDir::new().unwrap();
        let repo = git2::Repository::init(dir.path()).unwrap();
        (dir, repo)
    }

    #[test]
    fn open_existing_repo() {
        let (dir, _) = init_test_repo();
        let result = open_repo(dir.path().to_str().unwrap());
        assert!(result.is_ok());
    }

    #[test]
    fn open_missing_repo_returns_error() {
        let result = open_repo("/nonexistent/path");
        assert!(matches!(result, Err(GitError::NotFound(_))));
    }
}
