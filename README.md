<p align="center">
  <img src="log.png" alt="J6N — Git Repository Manager" width="200" />
</p>

<h1 align="center">J6N — Git Repository Manager</h1>

<p align="center">
  Client Git graphique de bureau, construit avec <strong>Tauri 2</strong> (backend Rust + <code>git2</code>)
  et <strong>React 19 / TypeScript</strong> (frontend Vite + Tailwind + Zustand).
</p>

<p align="center">
  <img src="docs/demo.gif" alt="Démo : graphe avec les auteurs, squash de plusieurs commits, suppression de plusieurs branches" width="960" />
</p>

## Fonctionnalités

- **Dépôts** : ouvrir, initialiser, cloner (avec la liste des dépôts de tes comptes), dépôts récents, multi-fenêtres.
- **Historique** : graphe de toutes les branches (locales, distantes, tags), recherche, détail d'un commit (message, auteur, fichiers modifiés) et diff de chaque fichier. Chaque point du graphe porte les initiales de l'auteur, dont le nom s'affiche au survol. Sélection de plusieurs commits avec Ctrl+clic (ou Cmd+clic) et Maj+clic pour une plage, puis clic droit → **Squasher les commits sélectionnés** : ils sont fusionnés dans le plus ancien, avec un message modifiable (pré-rempli avec les messages d'origine).
- **Copie de travail** : indexer / désindexer / annuler par fichier, par bloc (hunk) ou ligne par ligne depuis le diff (clic, Maj+clic pour une plage), commit avec résumé + description, amend.
- **Branches** : création, checkout (y compris d'une branche distante avec suivi, ou d'un commit en HEAD détaché), renommage, suppression, branche suivie, ahead/behind. Un badge `local` signale, dans la barre latérale et sur le graphe, les branches qui n'existent sur aucun remote. Plusieurs branches locales peuvent être sélectionnées (Ctrl+clic, Maj+clic) et supprimées en une fois.
- **Intégration** : merge (fast-forward ou commit de merge), rebase, cherry-pick, revert, reset soft/mixed/hard, avec résolution de conflits et continuer / annuler.
- **Rebase interactif** (clic droit sur un commit) : réordonner (glisser-déposer ou flèches), renommer, modifier (arrêt pour amender ou ajouter des commits), fusionner (squash / fixup) ou supprimer des commits. Avec des merges dans l'historique, au choix : *aplatir* (comme `git rebase -i`) ou *préserver les merges* (comme `--rebase-merges` : forme conservée, résolutions de conflits des merges gardées). Le rebase s'arrête sur un conflit à résoudre puis « Continuer », et peut être annulé à tout moment pour revenir exactement à l'état initial ; l'ancienne position reste accessible via `ORIG_HEAD`. Comme avec git, un commit devenu vide (ses changements sont déjà présents) est sauté.
- **Sous-modules** : liste et état, initialisation / mise à jour récursive (avec les identifiants des comptes), récupération automatique après un clone, ouverture dans une nouvelle fenêtre.
- **Git LFS** (nécessite [git-lfs](https://git-lfs.com)) : les fichiers LFS sont indexés via `git add` (pointeur, pas le binaire), les objets LFS sont envoyés avant chaque push et récupérés après clone / pull / checkout ; suivi de motifs, liste des fichiers non téléchargés.
- **Remotes** : fetch, pull (merge ou rebase), push (forcé en option), suppression de branche distante, ajout / suppression de remotes.
- **Tags et stash** : tags légers ou annotés (création, push, suppression), stash (avec fichiers non suivis), apply, pop, drop.
- **Comptes** : GitHub, GitLab.com et GitLab auto-hébergé, par connexion navigateur (OAuth, voir plus bas) ou token personnel. Le token est validé à l'ajout puis stocké dans le trousseau du système (Secret Service, Keychain, Credential Manager). À défaut de trousseau, il est écrit dans `tokens.json` (droits 600) du dossier de configuration de l'app. Le compte dont l'hôte correspond au remote est utilisé automatiquement pour clone / fetch / pull / push en HTTPS ; en SSH, l'agent puis les clés `~/.ssh` sont utilisés. Les PR/MR et issues du dépôt courant sont affichées, avec checkout de la branche d'une PR et lien de création de PR/MR.
- **Identité Git** : nom et email, globaux ou propres au dépôt.
- **Mises à jour automatiques** : au démarrage, l'application vérifie s'il existe une nouvelle release, propose de l'installer puis redémarre (aussi via le menu J6N → « Rechercher des mises à jour… »). Les paquets sont signés et la signature est vérifiée avant toute installation (AppImage, `.deb`, `.exe`, `.msi`).

Le code de l'application se trouve dans le dossier [`git-client/`](git-client/).

## Prérequis

- **Node.js** 22.12+ et npm
- **Rust** stable (via [rustup](https://rustup.rs/))
- Les dépendances système de Tauri :

  **Linux (Debian/Ubuntu)**

  ```bash
  sudo apt-get update
  sudo apt-get install -y \
    pkg-config libssl-dev libgit2-dev libdbus-1-dev \
    libwebkit2gtk-4.1-dev libgtk-3-dev \
    libayatana-appindicator3-dev librsvg2-dev
  ```

  **Windows** : Microsoft C++ Build Tools et WebView2 (préinstallé sur Windows 10/11).

- Optionnel : [git](https://git-scm.com) et [git-lfs](https://git-lfs.com) dans le `PATH` pour les dépôts utilisant Git LFS.
  Voir la [doc Tauri](https://v2.tauri.app/start/prerequisites/) pour les autres plateformes.

## Sécurité

- **Tokens** : stockés dans le trousseau du système ; ils ne quittent jamais le backend Rust (les appels aux API GitHub / GitLab sont faits côté Rust, l'interface n'a pas accès aux tokens). Sans trousseau disponible, repli sur un fichier `tokens.json` (droits 600) avec un avertissement.
- **Envoi des identifiants** : uniquement au serveur du compte et en HTTPS (pas après une redirection vers un autre hôte, pas à un serveur LFS tiers déclaré par un dépôt). Les instances doivent être en HTTPS (HTTP accepté seulement pour `localhost`).
- **Dépôts non fiables** : libgit2 n'exécute aucune commande définie par un dépôt ; les rares appels à `git` (Git LFS) imposent leurs réglages (pas de hooks, fsmonitor, helpers ou filtres définis par la configuration locale du dépôt).
- **Interface** : CSP stricte (scripts locaux uniquement, aucun accès réseau depuis le webview), `freezePrototype`, chemins de fichiers validés côté Rust (pas de sortie du dépôt).
- **Dépendances** : `npm audit` et `cargo audit` exécutés à chaque CI.

## Connexion OAuth

La connexion par navigateur utilise le *device flow* : l'application affiche un code à saisir sur la forge. Elle ne contient aucun secret, mais a besoin de l'identifiant client d'une application OAuth enregistrée :

- **GitHub** : *Settings → Developer settings → OAuth Apps → New OAuth App*, cocher **Enable Device Flow** (l'URL de callback n'est pas utilisée).
- **GitLab** (gitlab.com ou instance ≥ 17.2) : *Préférences → Applications*, application **non confidentielle**, scopes `api`, `read_user`, `write_repository`.

L'identifiant se saisit dans le formulaire d'ajout de compte (il est mémorisé par instance), ou se fournit par variable d'environnement, lue au lancement de l'application puis, à défaut, intégrée au build :

```bash
export GIT_CLIENT_GITHUB_CLIENT_ID=Ov23li...
export GIT_CLIENT_GITLAB_CLIENT_ID=abc123...
npm run tauri dev     # à lancer depuis ce même terminal
```

En CI, le workflow de release intègre au binaire les variables (ou secrets) de dépôt `GIT_CLIENT_GITHUB_CLIENT_ID` et `GIT_CLIENT_GITLAB_CLIENT_ID`.

Les tokens GitLab expirent au bout de 2 h : ils sont renouvelés automatiquement grâce au refresh token.

## Lancer en local

```bash
cd git-client
npm install
npm run tauri dev
```

`npm run tauri dev` démarre le serveur Vite sur `http://localhost:1420` puis compile et ouvre l'application Tauri. Le premier lancement est long (compilation des crates Rust) ; les suivants sont incrémentaux. Le frontend se recharge à chaud, et les modifications du code Rust déclenchent une recompilation automatique.

> Le port 1420 doit être libre (`strictPort` est activé dans `vite.config.ts`).

## Tests et vérifications

Depuis `git-client/` :

```bash
npx tsc --noEmit      # vérification TypeScript
npm run lint          # ESLint : règles TypeScript, SonarJS et hooks React
npx vitest run        # tests frontend (Vitest + Testing Library)
```

Depuis `git-client/src-tauri/` :

```bash
cargo clippy -- -D warnings   # lint Rust
cargo test                    # tests Rust
```

Ce sont les mêmes étapes que la CI (`.github/workflows/ci.yml`).

## Build de production

```bash
cd git-client
npm run tauri build
```

Les installeurs sont générés dans `git-client/src-tauri/target/release/bundle/` (`.deb` / `.AppImage` sous Linux, `.msi` / `.exe` sous Windows).

## Intégration continue et releases

- **À chaque push** (toutes branches) et sur les pull requests : tests Rust et frontend, lint, audit des dépendances (`.github/workflows/ci.yml`).
- **À chaque merge sur `main`** (`.github/workflows/release.yml`) :
  1. les mêmes tests ;
  2. calcul de la version d'après les messages de commit depuis le dernier tag ([Conventional Commits](https://www.conventionalcommits.org)) :
     - `feat!:` ou `BREAKING CHANGE:` → version majeure,
     - `feat:` → version mineure,
     - `fix:`, `perf:`, `refactor:`, `build:` ou message libre → correctif,
     - uniquement `docs:`, `ci:`, `test:`, `chore:`, `style:` → pas de release ;
  3. mise à jour de la version (`package.json`, `package-lock.json`, `Cargo.toml`, `Cargo.lock`, `tauri.conf.json`), commit `chore(release): vX.Y.Z` sur `main` et tag `vX.Y.Z` ;
  4. génération des paquets Linux (`.deb`, `.AppImage`) et Windows (`.msi`, `.exe`) puis publication automatique de la release GitHub, une fois tous les paquets prêts (si une plateforme échoue, la release reste en brouillon).

La branche `main` étant protégée, le commit de version est poussé avec le secret `RELEASE_TOKEN` : un token autorisé à contourner la protection (GitHub App ou token *fine-grained* limité à ce dépôt, permission « Contents : read and write »).

Vérifier localement la prochaine version : `node git-client/scripts/version.mjs next`.

Les mises à jour automatiques reposent sur une clé de signature dédiée : la clé publique est dans `tauri.conf.json` (`plugins > updater > pubkey`), la clé privée et son mot de passe dans les secrets `TAURI_SIGNING_PRIVATE_KEY` et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Le build signe chaque paquet et publie `latest.json`, le manifeste que l'application consulte. **Si la clé privée est perdue, les versions installées ne pourront plus être mises à jour** : la conserver dans un gestionnaire de mots de passe.
## Structure

```
git-client/
├── src/                 # Frontend React
│   ├── components/      # UI (Sidebar, Toolbar, DiffViewer, StagingPanel, ConflictViewer…)
│   ├── graph/           # Rendu du graphe de commits
│   ├── store/           # État global (Zustand)
│   ├── ipc/commands.ts  # Appels aux commandes Tauri
│   ├── lib/             # Actions git, URL de remote, plan de squash, sélection multiple…
│   └── api/             # Clients GitHub / GitLab
└── src-tauri/           # Backend Rust
    └── src/
        ├── lib.rs       # Enregistrement des commandes Tauri
        ├── commands.rs  # Commandes exposées au frontend (réseau hors thread UI)
        ├── accounts.rs  # Comptes GitHub / GitLab et stockage des tokens
        ├── oauth.rs     # Connexion OAuth (device flow) et renouvellement des tokens
        ├── window.rs    # Gestion multi-fenêtres
        └── git/         # Opérations Git (git2) : status, diff, patch (hunks), history, merge, rebase,
                         # interactive (rebase -i), stash, submodule, lfs, remote, auth…
```

## Licence

Distribué sous licence [MIT](LICENSE).
