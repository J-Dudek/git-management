import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { clearPullRequestCache, usePullRequests, type LinkedForge } from "./PullRequestList";
import { useAccountsStore } from "../store/useAccountsStore";
import type { ForgeClient } from "../api/forge";
import type { ForgeAccount, ForgePR } from "../types/forge";

const account: ForgeAccount = { id: "acc", provider: "github", label: "a", base_url: "https://github.com", username: "me", auth: "pat" };
const forge: LinkedForge = { account, projectPath: "o/r", remoteName: "origin" };
const pr = (number: number, state: ForgePR["state"] = "open"): ForgePR => ({
  number, title: `PR ${number}`, state, author: "me", url: "", createdAt: "", draft: false, labels: [],
  sourceBranch: `b${number}`, targetBranch: "main", reviewers: [], assignees: [],
});

let getPullRequests: ReturnType<typeof vi.fn>;

beforeEach(() => {
  clearPullRequestCache();
  getPullRequests = vi.fn((_path: string, state: string) => Promise.resolve(state === "merged" ? [pr(1, "merged")] : [pr(4)]));
  useAccountsStore.setState({ client: async () => ({ getPullRequests }) as unknown as ForgeClient });
});

describe("usePullRequests", () => {
  it("shows cached pull requests immediately after a remount, while refreshing", async () => {
    const first = renderHook(() => usePullRequests(forge));
    expect(first.result.current.loading).toBe(true);
    await waitFor(() => expect(first.result.current.openPrs.map((p) => p.number)).toEqual([4]));
    first.unmount();

    let release!: (prs: ForgePR[]) => void;
    getPullRequests.mockClear();
    getPullRequests.mockImplementation(() => new Promise((resolve) => (release = resolve)));
    const second = renderHook(() => usePullRequests(forge));
    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.openPrs.map((p) => p.number)).toEqual([4]);
    await waitFor(() => expect(getPullRequests).toHaveBeenCalledTimes(1));
    expect(second.result.current.openPrs.map((p) => p.number)).toEqual([4]);

    await act(async () => release([pr(4), pr(5)]));
    expect(second.result.current.openPrs.map((p) => p.number)).toEqual([4, 5]);
  });

  it("keeps branch badges while another state filter loads for the first time", async () => {
    const { result } = renderHook(() => usePullRequests(forge));
    await waitFor(() => expect(result.current.openPrs).toHaveLength(1));
    act(() => result.current.setState("merged"));
    expect(result.current.openPrs.map((p) => p.number)).toEqual([4]);
    await waitFor(() => expect(result.current.prs.map((p) => p.number)).toEqual([1]));
    expect(result.current.openPrs.map((p) => p.number)).toEqual([4]);
  });
});
