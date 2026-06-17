use git2::{Repository, Status};
use serde::Serialize;
use super::error::GitError;

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FileStatusKind {
    Modified,
    Added,
    Deleted,
    Renamed,
    Untracked,
    Conflicted,
}

#[derive(Debug, Serialize, Clone)]
pub struct FileStatus {
    pub path: String,
    pub status: FileStatusKind,
    pub staged: bool,
}

pub fn get_status(repo: &Repository) -> Result<Vec<FileStatus>, GitError> {
    let statuses = repo.statuses(None)?;

    let files = statuses
        .iter()
        .filter_map(|entry| {
            let path = entry.path()?.to_string();
            let s = entry.status();
            status_to_file_status(path, s)
        })
        .collect();

    Ok(files)
}

fn status_to_file_status(path: String, s: Status) -> Option<FileStatus> {
    if s.contains(Status::CONFLICTED) {
        return Some(FileStatus { path, status: FileStatusKind::Conflicted, staged: false });
    }

    let staged_kind = if s.contains(Status::INDEX_NEW) {
        Some((FileStatusKind::Added, true))
    } else if s.contains(Status::INDEX_MODIFIED) {
        Some((FileStatusKind::Modified, true))
    } else if s.contains(Status::INDEX_DELETED) {
        Some((FileStatusKind::Deleted, true))
    } else if s.contains(Status::INDEX_RENAMED) {
        Some((FileStatusKind::Renamed, true))
    } else {
        None
    };

    let wt_kind = if s.contains(Status::WT_NEW) {
        Some((FileStatusKind::Untracked, false))
    } else if s.contains(Status::WT_MODIFIED) {
        Some((FileStatusKind::Modified, false))
    } else if s.contains(Status::WT_DELETED) {
        Some((FileStatusKind::Deleted, false))
    } else {
        None
    };

    let (status, staged) = staged_kind.or(wt_kind)?;
    Some(FileStatus { path, status, staged })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn make_repo() -> (TempDir, Repository) {
        let dir = TempDir::new().unwrap();
        let repo = Repository::init(dir.path()).unwrap();
        (dir, repo)
    }

    #[test]
    fn empty_repo_has_no_status() {
        let (_dir, repo) = make_repo();
        let status = get_status(&repo).unwrap();
        assert!(status.is_empty());
    }

    #[test]
    fn untracked_file_appears_in_status() {
        let (dir, repo) = make_repo();
        fs::write(dir.path().join("file.txt"), "hello").unwrap();
        let status = get_status(&repo).unwrap();
        assert_eq!(status.len(), 1);
        assert_eq!(status[0].status, FileStatusKind::Untracked);
        assert!(!status[0].staged);
    }

    #[test]
    fn staged_file_appears_as_staged() {
        let (dir, repo) = make_repo();
        let file_path = dir.path().join("file.txt");
        fs::write(&file_path, "hello").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("file.txt")).unwrap();
        index.write().unwrap();

        let status = get_status(&repo).unwrap();
        assert_eq!(status.len(), 1);
        assert_eq!(status[0].status, FileStatusKind::Added);
        assert!(status[0].staged);
    }
}
