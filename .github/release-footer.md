### Téléchargements
- **Linux** : `.deb` (Debian/Ubuntu) · `.AppImage` (universel)
- **Windows** : `.msi` (installateur) · `.exe` (NSIS)
- **Android** : `.apk` (téléphones arm64, à installer hors Play Store : autoriser l'installation depuis le navigateur ou le gestionnaire de fichiers)

### Windows : avertissement SmartScreen
Les installateurs ne sont pas encore signés : au premier lancement, Windows affiche
« Windows a protégé votre ordinateur ». Cliquez sur **Informations complémentaires**,
puis sur **Exécuter quand même**.

### Vérifier un téléchargement
Les empreintes SHA-256 de tous les fichiers sont dans `SHA256SUMS.txt` :
- Linux : `sha256sum -c SHA256SUMS.txt --ignore-missing`
- Windows (PowerShell) : `Get-FileHash .\<fichier>` puis comparer avec la ligne correspondante
