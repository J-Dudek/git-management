import { create } from "zustand";

export interface Toast {
  id: number;
  kind: "error" | "success" | "info";
  message: string;
}

export interface DialogOptions {
  title: string;
  message?: string;
  /** Affiche un champ texte ; sa valeur est renvoyée dans `value`. */
  input?: { placeholder?: string; initial?: string; multiline?: boolean; secret?: boolean };
  /** Affiche une case à cocher ; son état est renvoyé dans `checked`. */
  checkbox?: { label: string; initial?: boolean };
  confirmLabel?: string;
  danger?: boolean;
}

export interface DialogResult {
  value: string;
  checked: boolean;
}

interface PendingDialog extends DialogOptions {
  resolve: (result: DialogResult | null) => void;
}

interface UiStore {
  toasts: Toast[];
  dialog: PendingDialog | null;
  /** Libellé de l'opération longue en cours (fetch, push…), null si aucune. */
  busy: string | null;
  /** Commit de base du rebase interactif en cours de préparation. */
  interactiveRebaseBase: string | null;

  notify: (kind: Toast["kind"], message: string) => void;
  dismiss: (id: number) => void;
  ask: (options: DialogOptions) => Promise<DialogResult | null>;
  closeDialog: (result: DialogResult | null) => void;
  setBusy: (label: string | null) => void;
  setInteractiveRebaseBase: (hash: string | null) => void;
}

let nextToastId = 1;

export const useUiStore = create<UiStore>((set, get) => ({
  toasts: [],
  dialog: null,
  busy: null,
  interactiveRebaseBase: null,

  notify: (kind, message) => {
    const id = nextToastId++;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => get().dismiss(id), kind === "error" ? 10000 : 4000);
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  ask: (options) =>
    new Promise((resolve) => {
      get().dialog?.resolve(null);
      set({ dialog: { ...options, resolve } });
    }),

  closeDialog: (result) => {
    get().dialog?.resolve(result);
    set({ dialog: null });
  },

  setBusy: (busy) => set({ busy }),
  setInteractiveRebaseBase: (interactiveRebaseBase) => set({ interactiveRebaseBase }),
}));

/** Fenêtre de confirmation simple. */
export async function confirmAction(title: string, message?: string, danger = false): Promise<boolean> {
  const result = await useUiStore.getState().ask({ title, message, danger, confirmLabel: danger ? "Confirmer" : "OK" });
  return result !== null;
}

/** Demande une valeur texte ; renvoie null si annulé ou vide. */
export async function promptText(title: string, options: { placeholder?: string; initial?: string; message?: string } = {}): Promise<string | null> {
  const result = await useUiStore.getState().ask({
    title,
    message: options.message,
    input: { placeholder: options.placeholder, initial: options.initial },
  });
  const value = result?.value.trim();
  return value ? value : null;
}
