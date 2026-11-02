import { describe, expect, it } from "vitest";
import { defaultWorktreePath, removalMessage } from "./worktrees";
import type { WorktreeInfo } from "../types/git";

const worktree = (patch: Partial<WorktreeInfo> = {}): WorktreeInfo => ({
  name: "wt", path: "/src/wt", branch: "feat", head_hash: "abc", is_main: false, is_current: false, locked: false, valid: true, ...patch,
});

describe("defaultWorktreePath", () => {
  it("place le worktree à côté du dépôt, sans sous-dossier pour les branches à préfixe", () => {
    expect(defaultWorktreePath("/src/app/", "feat/login")).toBe("/src/app-feat-login");
    expect(defaultWorktreePath("C:\\src\\app", "fix")).toBe("C:\\src\\app-fix");
  });
});

describe("removalMessage", () => {
  it("prévient des modifications perdues et de la branche conservée", () => {
    expect(removalMessage(worktree(), 0)).toBe("Le dossier /src/wt et tout son contenu seront supprimés. La branche feat est conservée.");
    expect(removalMessage(worktree(), 1)).toContain("1 fichier modifié ou non suivi sera définitivement perdu.");
    expect(removalMessage(worktree(), 3)).toContain("3 fichiers modifiés ou non suivis seront définitivement perdus.");
  });

  it("ne parle que de la référence si le dossier a disparu", () => {
    expect(removalMessage(worktree({ valid: false }), 0)).toContain("seule sa référence");
  });
});
