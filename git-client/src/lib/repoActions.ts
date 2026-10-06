import { open } from "@tauri-apps/plugin-dialog";
import { useRepoStore } from "../store/useRepoStore";
import { useUiStore } from "../store/useUiStore";
import { initRepository } from "../ipc/commands";
import { errorMessage } from "./actions";

export async function openRepoAt(path: string) {
  try {
    await useRepoStore.getState().openRepo(path);
  } catch (e) {
    useUiStore.getState().notify("error", `Impossible d'ouvrir ${path} : ${errorMessage(e)}`);
  }
}

export async function chooseAndOpenRepo() {
  const selected = await open({ directory: true, multiple: false });
  if (typeof selected === "string") await openRepoAt(selected);
}

export async function chooseAndInitRepo() {
  const selected = await open({ directory: true, multiple: false });
  if (typeof selected !== "string") return;
  try {
    await initRepository(selected);
    await openRepoAt(selected);
  } catch (e) {
    useUiStore.getState().notify("error", errorMessage(e));
  }
}
