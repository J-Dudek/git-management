//! Merathon lit la configuration avec libgit2 : il doit appliquer `includeIf` comme `git`.
//! Test à part : le chemin de la configuration globale de libgit2 vaut pour tout le processus.

use git2::{opts, ConfigLevel, Repository};
use std::fs;

#[test]
fn libgit2_applies_include_if_gitdir() {
    let tmp = tempfile::TempDir::new().unwrap();
    let home = tmp.path().canonicalize().unwrap();
    let pro = home.join("dev/pro");
    let autre = home.join("dev/autre");
    fs::create_dir_all(&pro).unwrap();
    fs::create_dir_all(&autre).unwrap();
    fs::write(home.join(".gitconfig-pro"), "[user]\n\temail = pro@example.com\n").unwrap();
    fs::write(
        home.join(".gitconfig"),
        format!(
            "[user]\n\temail = global@example.com\n[includeIf \"gitdir:{}/\"]\n\tpath = {}\n",
            pro.display(),
            home.join(".gitconfig-pro").display()
        ),
    )
    .unwrap();
    // SAFETY : un seul test dans ce binaire, avant toute ouverture de configuration.
    unsafe { opts::set_search_path(ConfigLevel::Global, &home).unwrap() };

    let email = |repo: &Repository| repo.config().unwrap().snapshot().unwrap().get_string("user.email").unwrap();
    assert_eq!(email(&Repository::init(pro.join("app")).unwrap()), "pro@example.com");
    assert_eq!(email(&Repository::init(autre.join("app")).unwrap()), "global@example.com");

    let repo = Repository::open(pro.join("app")).unwrap();
    let config = repo.config().unwrap();
    let entry = config.get_entry("user.email").unwrap();
    assert_eq!(entry.level(), ConfigLevel::Global);
    assert!(entry.include_depth() > 0);
}
