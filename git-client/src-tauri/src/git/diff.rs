use std::cell::RefCell;
use git2::{DiffOptions, Repository};
use serde::Serialize;
use super::error::GitError;

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DiffLineKind {
    Context,
    Added,
    Removed,
}

#[derive(Debug, Serialize, Clone)]
pub struct DiffLine {
    pub kind: DiffLineKind,
    pub content: String,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
}

#[derive(Debug, Serialize, Clone)]
pub struct DiffHunk {
    pub header: String,
    pub old_start: u32,
    pub new_start: u32,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Serialize, Clone)]
pub struct FileDiff {
    pub path: String,
    pub hunks: Vec<DiffHunk>,
    pub is_binary: bool,
}

pub fn get_diff(repo: &Repository, file_path: &str, staged: bool) -> Result<FileDiff, GitError> {
    let mut opts = DiffOptions::new();
    opts.pathspec(file_path);

    let diff = if staged {
        let head_tree = repo
            .head()
            .ok()
            .and_then(|r| r.peel_to_tree().ok());
        repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut opts))?
    } else {
        repo.diff_index_to_workdir(None, Some(&mut opts))?
    };

    let hunks: RefCell<Vec<DiffHunk>> = RefCell::new(Vec::new());
    let is_binary: RefCell<bool> = RefCell::new(false);

    diff.foreach(
        &mut |_delta, _progress| true,
        Some(&mut |_delta, _| {
            *is_binary.borrow_mut() = true;
            true
        }),
        Some(&mut |_delta, hunk| {
            let header = std::str::from_utf8(hunk.header()).unwrap_or("").trim_end().to_string();
            hunks.borrow_mut().push(DiffHunk {
                header,
                old_start: hunk.old_start(),
                new_start: hunk.new_start(),
                lines: Vec::new(),
            });
            true
        }),
        Some(&mut |_delta, _hunk, line| {
            let kind = match line.origin() {
                '+' => DiffLineKind::Added,
                '-' => DiffLineKind::Removed,
                _ => DiffLineKind::Context,
            };
            let content = std::str::from_utf8(line.content()).unwrap_or("").trim_end().to_string();
            if let Some(hunk) = hunks.borrow_mut().last_mut() {
                hunk.lines.push(DiffLine {
                    kind,
                    content,
                    old_lineno: line.old_lineno(),
                    new_lineno: line.new_lineno(),
                });
            }
            true
        }),
    )?;

    Ok(FileDiff {
        path: file_path.to_string(),
        hunks: hunks.into_inner(),
        is_binary: is_binary.into_inner(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;
    use git2::{Repository, Signature};

    fn make_repo_with_commit(content: &str) -> (TempDir, Repository) {
        let dir = TempDir::new().unwrap();
        let repo = Repository::init(dir.path()).unwrap();
        let mut cfg = repo.config().unwrap();
        cfg.set_str("user.name", "Test").unwrap();
        cfg.set_str("user.email", "test@test.com").unwrap();

        fs::write(dir.path().join("file.txt"), content).unwrap();

        let sig = Signature::now("Test", "test@test.com").unwrap();
        {
            let mut index = repo.index().unwrap();
            index.add_path(std::path::Path::new("file.txt")).unwrap();
            index.write().unwrap();
            let tree_id = index.write_tree().unwrap();
            let tree = repo.find_tree(tree_id).unwrap();
            repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[]).unwrap();
        }

        (dir, repo)
    }

    #[test]
    fn diff_unstaged_modified_file() {
        let (dir, repo) = make_repo_with_commit("hello\n");
        fs::write(dir.path().join("file.txt"), "hello\nworld\n").unwrap();

        let diff = get_diff(&repo, "file.txt", false).unwrap();
        assert!(!diff.is_binary);
        assert!(!diff.hunks.is_empty());

        let added: Vec<_> = diff.hunks[0].lines.iter()
            .filter(|l| l.kind == DiffLineKind::Added)
            .collect();
        assert_eq!(added.len(), 1);
        assert_eq!(added[0].content, "world");
    }

    #[test]
    fn diff_staged_file() {
        let (dir, repo) = make_repo_with_commit("hello\n");
        fs::write(dir.path().join("file.txt"), "hello\nworld\n").unwrap();
        {
            let mut index = repo.index().unwrap();
            index.add_path(std::path::Path::new("file.txt")).unwrap();
            index.write().unwrap();
        }

        let diff = get_diff(&repo, "file.txt", true).unwrap();
        assert!(!diff.hunks.is_empty());
        let added: Vec<_> = diff.hunks[0].lines.iter()
            .filter(|l| l.kind == DiffLineKind::Added)
            .collect();
        assert_eq!(added.len(), 1);
        assert_eq!(added[0].content, "world");
    }

    #[test]
    fn diff_unchanged_file_has_no_hunks() {
        let (_dir, repo) = make_repo_with_commit("hello\n");
        let diff = get_diff(&repo, "file.txt", false).unwrap();
        assert!(diff.hunks.is_empty());
    }

    #[test]
    fn diff_includes_line_numbers() {
        let (dir, repo) = make_repo_with_commit("line1\nline2\n");
        fs::write(dir.path().join("file.txt"), "line1\nline2\nline3\n").unwrap();
        let diff = get_diff(&repo, "file.txt", false).unwrap();
        let added = diff.hunks[0].lines.iter().find(|l| l.kind == DiffLineKind::Added).unwrap();
        assert!(added.new_lineno.is_some());
    }
}
