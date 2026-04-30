import type { Account, Group, AppState, AppSettings } from '@shared/types';

declare global {
  interface Window {
    electronAPI: {
      getAccounts: () => Promise<Account[]>;
      addAccount: (account: Account) => Promise<Account[]>;
      removeAccount: (accountId: string) => Promise<Account[]>;
      updateAccount: (account: Account) => Promise<Account[]>;
      reorderAccounts: (orderedIds: string[]) => Promise<Account[]>;
      clearSession: (accountId: string) => Promise<void>;
      getGroups: () => Promise<Group[]>;
      addGroup: (group: Group) => Promise<Group[]>;
      updateGroup: (group: Group) => Promise<Group[]>;
      removeGroup: (groupId: string) => Promise<{ groups: Group[]; accounts: Account[] }>;
      reorderGroups: (orderedIds: string[]) => Promise<Group[]>;
      openExternal: (url: string) => Promise<void>;
      getWebviewPreloadPath: () => Promise<string>;
      selectFolder: () => Promise<string | null>;
      getSettings: () => Promise<AppSettings>;
      updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
      getAppState: () => Promise<AppState>;
      saveAppState: (state: Partial<AppState>) => Promise<void>;
      onShortcut: (channel: string, callback: (...args: unknown[]) => void) => void;
      removeShortcutListener: (channel: string) => void;
    };
  }
}

export {};
