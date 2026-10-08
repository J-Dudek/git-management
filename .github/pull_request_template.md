<!--
Merci pour ta contribution ! 🙏
Le titre de la PR et les messages de commit suivent les Conventional Commits (feat:, fix:, docs:, refactor:, chore:…) :
la version de la prochaine release en est déduite (feat → mineure, fix → patch, `!` ou BREAKING CHANGE → majeure).
Pense à retirer toute donnée sensible (tokens, URLs privées, noms de dépôts internes) des captures.
-->

## Description

<!-- Ce que change cette PR et pourquoi, en quelques phrases. -->

Issue liée : <!-- Closes #123 (fermée automatiquement au merge), ou « aucune » -->

## Type de changement

- [ ] 🐞 Correction de bug (`fix:`)
- [ ] ✨ Nouvelle fonctionnalité (`feat:`)
- [ ] 💥 Changement cassant (`feat!:` / `fix!:`)
- [ ] ♻️ Refactorisation, sans changement de comportement (`refactor:`)
- [ ] 📝 Documentation (`docs:`)
- [ ] 🔧 Outillage, CI, dépendances (`chore:` / `ci:` / `build:`)

## Partie de l'application concernée

- [ ] Graphe des commits / historique
- [ ] Branches, tags, remotes (barre latérale)
- [ ] Indexation, commit, stash
- [ ] Merge, rebase, conflits
- [ ] Fetch, pull, push, clone
- [ ] Comptes GitHub / GitLab, pull / merge requests
- [ ] Sous-modules, Git LFS
- [ ] Terminal, onglet navigateur, journal
- [ ] Mises à jour de l'application
- [ ] Interface, affichage, préférences
- [ ] Backend Rust (Tauri)

## Comment tester

<!-- Les étapes pour vérifier le changement dans l'application. -->

1.
2.
3.

## Captures d'écran

<!-- Pour tout changement visible : avant / après (glisser-déposer ici). Sinon, supprime cette section. -->

## Vérifications

- [ ] Les commits suivent les [Conventional Commits](https://www.conventionalcommits.org/fr/)
- [ ] `npx tsc --noEmit`, `npm run lint` et `npx vitest run` passent (dans `git-client/`)
- [ ] `cargo clippy -- -D warnings` et `cargo test` passent (dans `git-client/src-tauri/`), si le backend est modifié
- [ ] Des tests couvrent le changement (ou ce n'est pas pertinent)
- [ ] Testé sur : <!-- Linux, Windows -->
- [ ] La documentation (README, docs/) est à jour si besoin
