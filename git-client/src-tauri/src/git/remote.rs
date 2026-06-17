use git2::{build::RepoBuilder, FetchOptions, Repository};
use super::error::GitError;

pub fn init_repo(path: &str) -> Result<(), GitError> {
    Repository::init(path)?;
    Ok(())
}

pub fn clone_repo(url: &str, path: &str) -> Result<(), GitError> {
    let mut fetch_opts = FetchOptions::new();
    fetch_opts.depth(1);

    RepoBuilder::new()
        .fetch_options(fetch_opts)
        .clone(url, std::path::Path::new(path))?;
    Ok(())
}

pub fn fetch(repo: &Repository, remote_name: &str) -> Result<(), GitError> {
    let mut remote = repo.find_remote(remote_name)?;
    let mut fetch_opts = FetchOptions::new();
    remote.fetch(&[] as &[&str], Some(&mut fetch_opts), None)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn init_creates_repository() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().to_str().unwrap();
        init_repo(path).unwrap();
        assert!(Repository::open(path).is_ok());
    }

    #[test]
    fn init_on_existing_path_is_ok() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().to_str().unwrap();
        init_repo(path).unwrap();
        // Re-init is idempotent
        assert!(init_repo(path).is_ok());
    }

    #[test]
    fn fetch_missing_remote_returns_error() {
        let dir = TempDir::new().unwrap();
        let repo = Repository::init(dir.path()).unwrap();
        let result = fetch(&repo, "origin");
        assert!(result.is_err());
    }
}
