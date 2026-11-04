import { afterEach, describe, expect, it, vi } from "vitest";
import { hasDesktopFeatures, isAndroid, isMobile } from "./platform";

const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const LINUX = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko)";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";

function userAgent(value: string) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(value);
}

afterEach(() => vi.restoreAllMocks());

describe("platform", () => {
  it("keeps desktop features on Linux", () => {
    userAgent(LINUX);
    expect(isAndroid()).toBe(false);
    expect(isMobile()).toBe(false);
    expect(hasDesktopFeatures()).toBe(true);
  });

  it("drops desktop features on Android", () => {
    userAgent(ANDROID);
    expect(isAndroid()).toBe(true);
    expect(isMobile()).toBe(true);
    expect(hasDesktopFeatures()).toBe(false);
  });

  it("treats iOS as mobile too", () => {
    userAgent(IPHONE);
    expect(isAndroid()).toBe(false);
    expect(hasDesktopFeatures()).toBe(false);
  });
});
