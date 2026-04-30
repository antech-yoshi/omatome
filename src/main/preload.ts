import { contextBridge, ipcRenderer } from 'electron';
import type { Account, Group, AppState, AppSettings } from '@shared/types';

const api = {
  // Account management
  getAccounts: (): Promise<Account[]> => ipcRenderer.invoke('account:list'),
  addAccount: (account: Account): Promise<Account[]> => ipcRenderer.invoke('account:add', account),
  removeAccount: (accountId: string): Promise<Account[]> => ipcRenderer.invoke('account:remove', accountId),
  updateAccount: (account: Account): Promise<Account[]> => ipcRenderer.invoke('account:update', account),
  reorderAccounts: (orderedIds: string[]): Promise<Account[]> => ipcRenderer.invoke('account:reorder', orderedIds),
  clearSession: (accountId: string): Promise<void> => ipcRenderer.invoke('account:clear-session', accountId),

  // Group management
  getGroups: (): Promise<Group[]> => ipcRenderer.invoke('group:list'),
  addGroup: (group: Group): Promise<Group[]> => ipcRenderer.invoke('group:add', group),
  updateGroup: (group: Group): Promise<Group[]> => ipcRenderer.invoke('group:update', group),
  removeGroup: (groupId: string): Promise<{ groups: Group[]; accounts: Account[] }> => ipcRenderer.invoke('group:remove', groupId),
  reorderGroups: (orderedIds: string[]): Promise<Group[]> => ipcRenderer.invoke('group:reorder', orderedIds),

  // Shell
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:open-external', url),

  // Webview preload path (file:// URL) for <webview preload="...">
  getWebviewPreloadPath: (): Promise<string> => ipcRenderer.invoke('webview:get-preload-path'),

  // Dialog
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:select-folder'),

  // Settings
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: Partial<AppSettings>): Promise<AppSettings> => ipcRenderer.invoke('settings:update', settings),

  // App state
  getAppState: (): Promise<AppState> => ipcRenderer.invoke('app:get-state'),
  saveAppState: (state: Partial<AppState>): Promise<void> => ipcRenderer.invoke('app:save-state', state),

  // Event listeners for shortcuts
  onShortcut: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = [
      'shortcut:settings',
      'shortcut:reload',
      'shortcut:reload-all',
      'shortcut:toggle-sidebar',
      'shortcut:find',
      'shortcut:back',
      'shortcut:forward',
      'shortcut:next-account',
      'shortcut:prev-account',
      'shortcut:switch-account',
      'app:before-close',
      'open-in-app-tab',
      'meta-key:down',
      'meta-key:up',
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },

  removeShortcutListener: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
