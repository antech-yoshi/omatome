import { app, BrowserWindow, ipcMain, nativeTheme, session, shell, webContents } from 'electron';
import path from 'path';
import { createStore } from './store';
import { registerIpcHandlers } from './ipc-handlers';
import { registerShortcuts } from './shortcuts';
import { checkForUpdates } from './update-checker';
import type { AppState } from '@shared/types';
import { PRESET_SERVICES } from '@shared/constants';

let mainWindow: BrowserWindow | null = null;

const store = createStore();

// Chrome-compatible User-Agent to bypass service browser checks (e.g. Slack)
// Electron 41 bundles Chromium 146, so we advertise as standard Chrome 146
const CHROME_USER_AGENT =
  process.platform === 'darwin'
    ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'
    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

function getServiceHostForPartition(partition: string): string {
  // Find the account by partition, then look up the service URL
  const accounts = store.get('accounts', []);
  const account = accounts.find((a) => `persist:${a.partitionKey}` === partition);
  if (!account) return '';
  const service = PRESET_SERVICES.find((s) => s.id === account.serviceId);
  if (!service) return '';
  try {
    return new URL(service.url).hostname;
  } catch {
    return '';
  }
}

// Extract the base domain (e.g., "slack.com" from "app.slack.com")
function getBaseDomain(hostname: string): string {
  const parts = hostname.split('.');
  // Handle cases like "co.jp", "com.au" etc.
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return hostname;
}

function isExternalUrl(url: string, serviceHost: string, relatedDomains: string[] = []): boolean {
  if (!serviceHost) return true;
  try {
    const linkHost = new URL(url).hostname;
    const linkBase = getBaseDomain(linkHost);
    const serviceBase = getBaseDomain(serviceHost);
    // Same base domain = same service (e.g., app.slack.com and workspace.slack.com)
    if (linkBase === serviceBase) return false;
    // Check related domains (e.g., facebook.com for messenger.com)
    for (const domain of relatedDomains) {
      if (linkBase === getBaseDomain(domain)) return false;
    }
    return true;
  } catch {
    return true;
  }
}

function handleExternalLink(url: string, serviceHost: string): void {
  const settings = store.get('settings');
  const external = isExternalUrl(url, serviceHost);

  if (!external) {
    // Same-service link — let webview handle it, do nothing here
    return;
  }

  if (settings.linkOpenBehavior === 'external-browser') {
    shell.openExternal(url);
  } else {
    // in-app: send to renderer to create ephemeral tab
    mainWindow?.webContents.send('open-in-app-tab', url);
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'omatome',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
    },
    show: false,
    backgroundColor: '#FFFFFF',
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Track Meta/Cmd key state globally and notify renderer
  // We need to monitor all webContents (main + webviews) for key events
  let metaKeyDown = false;

  const sendMetaState = (down: boolean) => {
    metaKeyDown = down;
    mainWindow?.webContents.send(down ? 'meta-key:down' : 'meta-key:up');
  };

  // Monitor main renderer webContents
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'Meta') {
      sendMetaState(input.type === 'keyDown');
    }
  });

  // Reset when window loses focus
  mainWindow.on('blur', () => sendMetaState(false));

  // Handle links opened from the main renderer window itself
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Intercept webview webContents creation for link handling
  mainWindow.webContents.on('did-attach-webview', (_event, webviewWebContents) => {
    console.log('[omatome] did-attach-webview fired for webContents id:', webviewWebContents.id);

    // Monitor Meta key in webview for shortcut badge display
    webviewWebContents.on('before-input-event', (_event, input) => {
      if (input.key === 'Meta') {
        sendMetaState(input.type === 'keyDown');
      }
    });

    // Handle downloads: apply configured download path
    webviewWebContents.session.on('will-download', (_event, item) => {
      const downloadPath = store.get('settings').downloadPath;
      if (downloadPath) {
        const filePath = path.join(downloadPath, item.getFilename());
        item.setSavePath(filePath);
      }
    });

    // Set Chrome-compatible User-Agent to bypass service browser checks (Slack, etc.)
    webviewWebContents.setUserAgent(CHROME_USER_AGENT);

    // Also intercept at the request level for maximum reliability
    webviewWebContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['User-Agent'] = CHROME_USER_AGENT;
      callback({ requestHeaders: details.requestHeaders });
    });

    // Auto-redirect when Slack shows the "launching workspace" page
    webviewWebContents.on('did-navigate', (_event: Electron.Event, url: string) => {
      // Detect Slack's "launch workspace" / "ssb/redirect" pages and go to web client
      const slackSsbMatch = url.match(/https:\/\/([^/]+\.slack\.com)\/(ssb|getting-started)/i);
      if (slackSsbMatch) {
        const workspace = slackSsbMatch[1];
        webviewWebContents.loadURL(`https://${workspace}/`);
        return;
      }
    });

    // Handle target="_blank" / window.open() inside webviews
    webviewWebContents.setWindowOpenHandler(({ url }) => {
      console.log('[omatome] setWindowOpenHandler fired:', url);

      // Block custom protocol schemes
      if (/^(slack|discord|msteams|tg|whatsapp):\/\//i.test(url)) {
        return { action: 'deny' };
      }

      // Determine service host and related domains from the webview's current URL
      let serviceHost = '';
      let relatedDomains: string[] = [];
      try {
        serviceHost = new URL(webviewWebContents.getURL()).hostname;
      } catch { /* ignore */ }

      const accounts = store.get('accounts', []);
      for (const account of accounts) {
        const service = PRESET_SERVICES.find((s) => s.id === account.serviceId);
        if (service) {
          try {
            const sHost = new URL(service.url).hostname;
            const currentHost = new URL(webviewWebContents.getURL()).hostname;
            if (getBaseDomain(currentHost) === getBaseDomain(sHost) ||
                (service.relatedDomains ?? []).some(d => getBaseDomain(currentHost) === getBaseDomain(d))) {
              serviceHost = sHost;
              relatedDomains = service.relatedDomains ?? [];
              break;
            }
          } catch { /* ignore */ }
        }
      }

      const external = isExternalUrl(url, serviceHost, relatedDomains);
      const settings = store.get('settings');

      console.log('[omatome] external:', external, 'linkOpenBehavior:', settings.linkOpenBehavior, 'serviceHost:', serviceHost, 'relatedDomains:', relatedDomains);
      if (external && settings.linkOpenBehavior === 'external-browser') {
        shell.openExternal(url);
      } else if (external && settings.linkOpenBehavior === 'in-app') {
        mainWindow?.webContents.send('open-in-app-tab', url);
      } else {
        // Same-service or related-domain navigation: load in the webview itself
        webviewWebContents.loadURL(url);
      }

      return { action: 'deny' };
    });

    // Handle navigation within the webview (link clicks, redirects)
    webviewWebContents.on('will-navigate', (event: Electron.Event, url: string) => {
      console.log('[omatome] will-navigate fired:', url);

      // Block custom protocol schemes (slack://, discord://, etc.)
      if (/^(slack|discord|msteams|tg|whatsapp):\/\//i.test(url)) {
        event.preventDefault();
        return;
      }

      // Block Slack's SSB redirect pages (they try to open the desktop app)
      if (/slack\.com\/(ssb\/redirect|signout_confirm)/i.test(url)) {
        event.preventDefault();
        return;
      }

      let serviceHost = '';
      let relatedDomains: string[] = [];
      const accounts = store.get('accounts', []);
      for (const account of accounts) {
        const service = PRESET_SERVICES.find((s) => s.id === account.serviceId);
        if (service) {
          try {
            const sHost = new URL(service.url).hostname;
            const currentHost = new URL(webviewWebContents.getURL()).hostname;
            if (getBaseDomain(currentHost) === getBaseDomain(sHost) ||
                (service.relatedDomains ?? []).some(d => getBaseDomain(currentHost) === getBaseDomain(d))) {
              serviceHost = sHost;
              relatedDomains = service.relatedDomains ?? [];
              break;
            }
          } catch { /* ignore */ }
        }
      }

      const external = isExternalUrl(url, serviceHost, relatedDomains);
      const settings = store.get('settings');

      console.log('[omatome] will-navigate external:', external, 'linkOpenBehavior:', settings.linkOpenBehavior);
      if (external && settings.linkOpenBehavior === 'external-browser') {
        event.preventDefault();
        console.log('[omatome] will-navigate: opening external browser:', url);
        shell.openExternal(url);
      } else if (external && settings.linkOpenBehavior === 'in-app') {
        event.preventDefault();
        console.log('[omatome] will-navigate: opening in app tab:', url);
        mainWindow?.webContents.send('open-in-app-tab', url);
      }
      // Same-service or related-domain: let navigation proceed normally
    });
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('close', () => {
    mainWindow?.webContents.send('app:before-close');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  const settings = store.get('settings');
  nativeTheme.themeSource = settings.appearance ?? 'system';

  registerIpcHandlers(store);
  createWindow();
  registerShortcuts(mainWindow!);

  // Check for updates silently after a short delay
  setTimeout(() => checkForUpdates(true), 5000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
