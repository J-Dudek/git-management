/**
 * Plateforme de l'application. Sur mobile (Android), il n'y a ni terminal, ni mises à jour hors du store, ni
 * fenêtres multiples : ces fonctions servent à masquer ce qui n'y existe pas. Lues à chaque appel (et non une
 * fois pour toutes) pour pouvoir simuler une plateforme dans les tests.
 */
export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

export function isMobile(): boolean {
  return isAndroid() || /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Terminal intégré, nouvelles fenêtres et mises à jour automatiques : bureau seulement. */
export function hasDesktopFeatures(): boolean {
  return !isMobile();
}
