/** Effet du bouton retour d'Android, du plus au moins imbriqué. */
export type BackAction = "close-overlay" | "show-graph" | "show-history" | "exit";

export function backAction(state: { overlayOpen: boolean; centerIsGraph: boolean; onHistory: boolean }): BackAction {
  if (state.overlayOpen) return "close-overlay";
  if (!state.centerIsGraph) return "show-graph";
  return state.onHistory ? "exit" : "show-history";
}

/** Tiroir, fenêtre ou menu ouvert : tous se ferment avec Échap. */
export function overlayOpen(): boolean {
  return document.querySelector("[role=dialog], [role=menu]") !== null;
}

export function closeOverlay() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}
