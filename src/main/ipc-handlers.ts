import { ipcMain, nativeTheme, session, shell, dialog } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';
import type { AppStore } from './store';
import type { Account, Group, AppState, AppSettings } from '@shared/types';

export function registerIpcHandlers(store: AppStore): void {
  // Open URL in default browser
  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    try {
      await shell.openExternal(url);
    } catch (err) {
      console.error('[omatome] shell.openExternal failed:', url, err);
    }
  });

  // file:// URL of the webview preload script (consumed by <webview preload="...">)
  ipcMain.handle('webview:get-preload-path', () => {
    return pathToFileURL(path.join(__dirname, '../preload/webview-preload.js')).toString();
  });

  ipcMain.handle('account:list', () => {
    return store.get('accounts', []);
  });

  ipcMain.handle('account:add', (_event, account: Account) => {
    const accounts = store.get('accounts', []);
    accounts.push(account);
    store.set('accounts', accounts);
    return accounts;
  });

  ipcMain.handle('account:remove', async (_event, accountId: string) => {
    const accounts = store.get('accounts', []);
    const account = accounts.find((a) => a.id === accountId);

    if (account) {
      const ses = session.fromPartition(`persist:${account.partitionKey}`);
      await ses.clearStorageData();
    }

    const updated = accounts.filter((a) => a.id !== accountId);
    store.set('accounts', updated);
    return updated;
  });

  ipcMain.handle('account:update', (_event, account: Account) => {
    const accounts = store.get('accounts', []);
    const index = accounts.findIndex((a) => a.id === account.id);
    if (index !== -1) {
      accounts[index] = account;
      store.set('accounts', accounts);
    }
    return accounts;
  });

  ipcMain.handle('account:reorder', (_event, orderedIds: string[]) => {
    const accounts = store.get('accounts', []);
    const reordered = orderedIds
      .map((id, index) => {
        const account = accounts.find((a) => a.id === id);
        if (account) {
          return { ...account, order: index };
        }
        return null;
      })
      .filter((a): a is Account => a !== null);
    store.set('accounts', reordered);
    return reordered;
  });

  ipcMain.handle('account:clear-session', async (_event, accountId: string) => {
    const accounts = store.get('accounts', []);
    const account = accounts.find((a) => a.id === accountId);
    if (account) {
      const ses = session.fromPartition(`persist:${account.partitionKey}`);
      await ses.clearStorageData();
    }
  });

  // Group management
  ipcMain.handle('group:list', () => {
    return store.get('groups', []);
  });

  ipcMain.handle('group:add', (_event, group: Group) => {
    const groups = store.get('groups', []);
    groups.push(group);
    store.set('groups', groups);
    return groups;
  });

  ipcMain.handle('group:update', (_event, group: Group) => {
    const groups = store.get('groups', []);
    const index = groups.findIndex((g) => g.id === group.id);
    if (index !== -1) {
      groups[index] = group;
      store.set('groups', groups);
    }
    return groups;
  });

  ipcMain.handle('group:reorder', (_event, orderedIds: string[]) => {
    const groups = store.get('groups', []);
    const reordered = orderedIds
      .map((id, index) => {
        const group = groups.find((g) => g.id === id);
        if (group) {
          return { ...group, order: index };
        }
        return null;
      })
      .filter((g): g is Group => g !== null);
    store.set('groups', reordered);
    return reordered;
  });

  ipcMain.handle('group:remove', (_event, groupId: string) => {
    const groups = store.get('groups', []).filter((g) => g.id !== groupId);
    store.set('groups', groups);
    const accounts = store.get('accounts', []).map((a) =>
      a.groupId === groupId ? { ...a, groupId: undefined } : a
    );
    store.set('accounts', accounts);
    return { groups, accounts };
  });

  // Settings
  ipcMain.handle('settings:get', () => {
    return store.get('settings');
  });

  ipcMain.handle('settings:update', (_event, settings: Partial<AppSettings>) => {
    const current = store.get('settings');
    const updated = { ...current, ...settings };
    store.set('settings', updated);
    if (settings.appearance) {
      nativeTheme.themeSource = settings.appearance;
    }
    return updated;
  });

  // Dialog
  ipcMain.handle('dialog:select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // App state
  ipcMain.handle('app:get-state', () => {
    return store.get('appState');
  });

  ipcMain.handle('app:save-state', (_event, state: Partial<AppState>) => {
    const current = store.get('appState');
    store.set('appState', { ...current, ...state });
  });
}
