import { describe, it, expect } from "vitest";
// @ts-expect-error module JavaScript sans déclarations de types
import { bumpForCommit, bumpForCommits, incrementVersion, maxVersion, setCargoVersion } from "./version.mjs";

describe("bumpForCommit", () => {
  it("détecte les changements majeurs", () => {
    expect(bumpForCommit("feat!: nouvelle API")).toBe("major");
    expect(bumpForCommit("fix(core)!: casse la compat")).toBe("major");
    expect(bumpForCommit("feat: x\n\nBREAKING CHANGE: suppression de y")).toBe("major");
  });

  it("feat → mineure, correctifs → patch", () => {
    expect(bumpForCommit("feat(ui): rebase interactif")).toBe("minor");
    expect(bumpForCommit("fix: crash au démarrage")).toBe("patch");
    expect(bumpForCommit("perf: graphe plus rapide")).toBe("patch");
    expect(bumpForCommit("Merge pull request #12 from x/y")).toBe("patch");
  });

  it("ignore les commits sans impact applicatif", () => {
    for (const msg of ["docs: README", "ci: cache", "test: plus de cas", "chore(release): v1.2.3", "style: format"]) {
      expect(bumpForCommit(msg)).toBeNull();
    }
  });
});

describe("bumpForCommits", () => {
  it("retient le plus fort", () => {
    expect(bumpForCommits(["fix: a", "feat: b", "docs: c"])).toBe("minor");
    expect(bumpForCommits(["fix: a", "feat!: b"])).toBe("major");
    expect(bumpForCommits(["docs: a", "ci: b"])).toBeNull();
    expect(bumpForCommits([])).toBeNull();
  });
});

describe("versions", () => {
  it("incrémente selon le type", () => {
    expect(incrementVersion("1.4.2", "patch")).toBe("1.4.3");
    expect(incrementVersion("1.4.2", "minor")).toBe("1.5.0");
    expect(incrementVersion("1.4.2", "major")).toBe("2.0.0");
    expect(() => incrementVersion("1.4", "patch")).toThrow();
  });

  it("compare numériquement", () => {
    expect(maxVersion("0.10.0", "0.9.9")).toBe("0.10.0");
    expect(maxVersion("1.0.0", "1.0.1")).toBe("1.0.1");
  });
});

describe("setCargoVersion", () => {
  it("met à jour uniquement la section [package] de Cargo.toml", () => {
    const toml = '[package]\nname = "git-client"\nversion = "0.1.0"\n\n[dependencies]\nserde = { version = "1" }\n';
    const out = setCargoVersion(toml, "0.2.0");
    expect(out).toContain('version = "0.2.0"');
    expect(out).toContain('serde = { version = "1" }');
  });

  it("met à jour uniquement le paquet git-client de Cargo.lock", () => {
    const lock = '[[package]]\nname = "git2"\nversion = "0.21.0"\n\n[[package]]\nname = "git-client"\nversion = "0.1.0"\n';
    const out = setCargoVersion(lock, "1.0.0", { lock: true });
    expect(out).toContain('name = "git2"\nversion = "0.21.0"');
    expect(out).toContain('name = "git-client"\nversion = "1.0.0"');
  });
});
