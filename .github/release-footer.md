### Téléchargements
- **Linux** : `.deb` (Debian/Ubuntu) · `.AppImage` (universel)
- **Windows** : `.msi` (installateur) · `.exe` (NSIS)
- **macOS** : `.dmg` universel (Apple Silicon et Intel)

### Windows : avertissement SmartScreen
Les installateurs ne sont pas encore signés : au premier lancement, Windows affiche
« Windows a protégé votre ordinateur ». Cliquez sur **Informations complémentaires**,
puis sur **Exécuter quand même**.

### macOS : avertissement au premier lancement
L'application n'est pas encore notarisée par Apple : macOS la bloque au premier lancement.
Ouvrez **Réglages Système → Confidentialité et sécurité**, puis cliquez sur **Ouvrir quand même**.

### Vérifier un téléchargement
Les empreintes SHA-256 de tous les fichiers sont dans `SHA256SUMS.txt` :
- Linux : `sha256sum -c SHA256SUMS.txt --ignore-missing`
- macOS : `shasum -a 256 -c SHA256SUMS.txt --ignore-missing`
- Windows (PowerShell) : `Get-FileHash .\<fichier>` puis comparer avec la ligne correspondante
