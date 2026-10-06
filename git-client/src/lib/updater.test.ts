import { describe, it, expect, vi } from "vitest";

vi.mock("@tauri-apps/plugin-updater", () => ({ check: vi.fn() }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ label: "main" }) }));

const { downloadLabel } = await import("./updater");

describe("downloadLabel", () => {
  it("shows a percentage when the size is known", () => {
    expect(downloadLabel(0, 0)).toBe("Téléchargement de la mise à jour…");
    expect(downloadLabel(512, 1024)).toBe("Téléchargement de la mise à jour… 50 %");
    expect(downloadLabel(2048, 1024)).toBe("Téléchargement de la mise à jour… 100 %");
  });
});
