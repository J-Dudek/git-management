import { describe, expect, it } from "vitest";
import { backAction } from "./androidBack";

describe("backAction", () => {
  const home = { overlayOpen: false, centerIsGraph: true, onHistory: true };

  it("closes what is open first", () => {
    expect(backAction({ overlayOpen: true, centerIsGraph: false, onHistory: false })).toBe("close-overlay");
  });

  it("then leaves a diff, then returns to the history, then exits", () => {
    expect(backAction({ ...home, centerIsGraph: false, onHistory: false })).toBe("show-graph");
    expect(backAction({ ...home, onHistory: false })).toBe("show-history");
    expect(backAction(home)).toBe("exit");
  });
});
