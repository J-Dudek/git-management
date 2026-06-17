import { create } from "zustand";
import type { ForgeAccount, AccountData } from "../types/forge";

interface AccountsStore {
  accounts: ForgeAccount[];
  data: Record<string, AccountData>;
  activeId: string | null;

  addAccount: (account: ForgeAccount) => void;
  removeAccount: (id: string) => void;
  updateAccount: (id: string, patch: Partial<ForgeAccount>) => void;
  setData: (id: string, data: Partial<AccountData>) => void;
  setActive: (id: string | null) => void;
}

function emptyData(): AccountData {
  return { prs: [], issues: [], loading: false, error: null };
}

export const useAccountsStore = create<AccountsStore>((set) => ({
  accounts: [],
  data: {},
  activeId: null,

  addAccount: (account) =>
    set((s) => ({
      accounts: [...s.accounts, account],
      data: { ...s.data, [account.id]: emptyData() },
      activeId: s.activeId ?? account.id,
    })),

  removeAccount: (id) =>
    set((s) => {
      const accounts = s.accounts.filter((a) => a.id !== id);
      const data = { ...s.data };
      delete data[id];
      const activeId = s.activeId === id ? (accounts[0]?.id ?? null) : s.activeId;
      return { accounts, data, activeId };
    }),

  updateAccount: (id, patch) =>
    set((s) => ({
      accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })),

  setData: (id, patch) =>
    set((s) => ({
      data: { ...s.data, [id]: { ...emptyData(), ...s.data[id], ...patch } },
    })),

  setActive: (activeId) => set({ activeId }),
}));
