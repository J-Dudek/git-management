mod error;
mod repository;
mod history;
mod status;
mod diff;
mod remote;
mod merge;
mod ops;

pub use error::GitError;
pub use repository::open_repo;
pub use history::{get_commits, get_branches, CommitInfo, BranchInfo};
pub use status::{get_status, FileStatus};
pub use diff::{get_diff, FileDiff};
pub use remote::{init_repo, clone_repo, fetch};
pub use merge::{merge_branch, get_conflict_content, resolve_conflict, MergeResult};
pub use ops::{checkout_branch, create_branch, delete_branch, rebase_onto};
