import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useUiStore } from "../store/useUiStore";
import { errorMessage } from "./actions";

/** Libellé de progression du téléchargement (pourcentage connu seulement si le serveur annonce la taille). */
export function downloadLabel(received: number, total: number): string {
  const base = "Téléchargement de la mise à jour…";
  return total > 0 ? `${base} ${Math.min(100, Math.round((received * 100) / total))} %` : base;
}

/**
 * Cherche une nouvelle version et propose de l'installer.
 * `manual` : demandé par l'utilisateur, qui est alors aussi prévenu quand l'appli est à jour ou en cas d'erreur.
 */
export async function checkForUpdates(manual = false) {
  const ui = useUiStore.getState();
  let update;
  try {
    update = await check();
  } catch (e) {
    if (manual) ui.notify("error", `Impossible de vérifier les mises à jour : ${errorMessage(e)}`);
    return;
  }
  if (!update) {
    if (manual) ui.notify("success", "Merathon est à jour");
    return;
  }

  const answer = await ui.ask({
    title: `Merathon ${update.version} est disponible`,
    message: `Version installée : ${update.currentVersion}. L'application redémarrera après l'installation.`,
    confirmLabel: "Installer et redémarrer",
  });
  if (!answer) return;

  let total = 0;
  let received = 0;
  ui.setBusy(downloadLabel(0, 0));
  try {
    await update.downloadAndInstall((event: DownloadEvent) => {
      if (event.event === "Started") total = event.data.contentLength ?? 0;
      if (event.event === "Progress") {
        received += event.data.chunkLength;
        ui.setBusy(downloadLabel(received, total));
      }
    });
    await relaunch();
  } catch (e) {
    ui.notify("error", `Échec de la mise à jour : ${errorMessage(e)}`);
  } finally {
    ui.setBusy(null);
  }
}

/** Vérification silencieuse au démarrage : version installée uniquement, depuis la fenêtre principale. */
export function checkForUpdatesOnStartup() {
  if (import.meta.env.DEV || getCurrentWindow().label !== "main") return;
  checkForUpdates();
}
