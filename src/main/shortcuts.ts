import { BrowserWindow, Menu, MenuItem } from 'electron';
import { checkForUpdates } from './update-checker';

function getFocusedWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
}

function sendToWindow(channel: string, ...args: unknown[]): void {
  const win = getFocusedWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, ...args);
  }
}

export function registerShortcuts(_window: BrowserWindow): void {
  const menu = Menu.buildFromTemplate([
    {
      label: 'omatome',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Check for Updates...',
          click: () => checkForUpdates(false),
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => sendToWindow('shortcut:settings'),
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload Page',
          accelerator: 'CmdOrCtrl+R',
          click: () => sendToWindow('shortcut:reload'),
        },
        {
          label: 'Reload All Services',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => sendToWindow('shortcut:reload-all'),
        },
        { type: 'separator' },
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendToWindow('shortcut:toggle-sidebar'),
        },
        { type: 'separator' },
        {
          label: 'Find in Page',
          accelerator: 'CmdOrCtrl+F',
          click: () => sendToWindow('shortcut:find'),
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Navigate',
      submenu: [
        {
          label: 'Back',
          accelerator: 'CmdOrCtrl+Left',
          click: () => sendToWindow('shortcut:back'),
        },
        {
          label: 'Forward',
          accelerator: 'CmdOrCtrl+Right',
          click: () => sendToWindow('shortcut:forward'),
        },
        { type: 'separator' },
        {
          label: 'Next Account',
          accelerator: 'CmdOrCtrl+]',
          click: () => sendToWindow('shortcut:next-account'),
        },
        {
          label: 'Previous Account',
          accelerator: 'CmdOrCtrl+[',
          click: () => sendToWindow('shortcut:prev-account'),
        },
        { type: 'separator' },
        ...Array.from({ length: 9 }, (_, i) => ({
          label: `Account ${i + 1}`,
          accelerator: `CmdOrCtrl+${i + 1}`,
          click: () => sendToWindow('shortcut:switch-account', i),
        })),
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        { type: 'separator' as const },
        { role: 'front' as const },
      ],
    },
  ]);

  Menu.setApplicationMenu(menu);
}
