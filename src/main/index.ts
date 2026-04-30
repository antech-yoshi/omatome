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

// Find the service host and related domains for a webview based on its current URL
function findServiceContext(currentUrl: string): { serviceHost: string; relatedDomains: string[] } {
  let serviceHost = '';
  let relatedDomains: string[] = [];

  try {
    serviceHost = new URL(currentUrl).hostname;
  } catch { /* ignore */ }

  const accounts = store.get('accounts', []);
  const currentHost = serviceHost;

  for (const account of accounts) {
    // Check preset service
    const service = PRESET_SERVICES.find((s) => s.id === account.serviceId);
    if (service) {
      try {
        const sHost = new URL(service.url).hostname;
        if (getBaseDomain(currentHost) === getBaseDomain(sHost) ||
            (service.relatedDomains ?? []).some(d => getBaseDomain(currentHost) === getBaseDomain(d))) {
          serviceHost = sHost;
          relatedDomains = service.relatedDomains ?? [];
          return { serviceHost, relatedDomains };
        }
      } catch { /* ignore */ }
    }

    // Check custom URL
    if (account.customUrl) {
      try {
        const customHost = new URL(account.customUrl).hostname;
        if (getBaseDomain(currentHost) === getBaseDomain(customHost)) {
          serviceHost = customHost;
          // For custom services, treat the base domain as related
          relatedDomains = [getBaseDomain(customHost)];
          return { serviceHost, relatedDomains };
        }
      } catch { /* ignore */ }
    }
  }

  return { serviceHost, relatedDomains };
}

// Dedup recently-handled URLs so the same click captured by both
// preload IPC and a main-side event doesn't open the browser twice.
const recentlyHandled = new Map<string, number>();
function shouldHandle(url: string): boolean {
  const now = Date.now();
  const last = recentlyHandled.get(url);
  if (last && now - last < 800) return false;
  recentlyHandled.set(url, now);
  if (recentlyHandled.size > 200) {
    for (const [k, t] of recentlyHandled.entries()) {
      if (now - t > 5000) recentlyHandled.delete(k);
    }
  }
  return true;
}

async function openExternalSafe(url: string): Promise<void> {
  try {
    await shell.openExternal(url);
  } catch (err) {
    console.error('[omatome] shell.openExternal failed:', url, err);
  }
}

type LinkRoute = 'external' | 'in-app' | 'same-service' | 'blocked';

function routeLink(url: string, sourceUrl: string): LinkRoute {
  if (/^(slack|discord|msteams|tg|whatsapp):\/\//i.test(url)) return 'blocked';
  if (/slack\.com\/(ssb\/redirect|signout_confirm)/i.test(url)) return 'blocked';

  const { serviceHost, relatedDomains } = findServiceContext(sourceUrl);
  const external = isExternalUrl(url, serviceHost, relatedDomains);
  if (!external) return 'same-service';

  const settings = store.get('settings');
  return settings.linkOpenBehavior === 'external-browser' ? 'external' : 'in-app';
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
    openExternalSafe(url);
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
      const slackSsbMatch = url.match(/https:\/\/([^/]+\.slack\.com)\/(ssb|getting-started|workspace-signin)/i);
      if (slackSsbMatch) {
        const workspace = slackSsbMatch[1];
        webviewWebContents.loadURL(`https://${workspace}/`);
      }
    });

    // Handle target="_blank" / window.open() inside webviews
    webviewWebContents.setWindowOpenHandler(({ url }) => {
      const route = routeLink(url, webviewWebContents.getURL());
      console.log('[omatome] setWindowOpenHandler:', url, '→', route);

      if (route === 'blocked') return { action: 'deny' };
      if (route === 'same-service') {
        webviewWebContents.loadURL(url);
        return { action: 'deny' };
      }
      if (!shouldHandle(url)) return { action: 'deny' };
      if (route === 'external') openExternalSafe(url);
      else mainWindow?.webContents.send('open-in-app-tab', url);
      return { action: 'deny' };
    });

    // Handle navigation within the webview (direct link clicks, JS-driven nav)
    webviewWebContents.on('will-navigate', (event: Electron.Event, url: string) => {
      const route = routeLink(url, webviewWebContents.getURL());
      console.log('[omatome] will-navigate:', url, '→', route);

      if (route === 'blocked') {
        event.preventDefault();
        return;
      }
      if (route === 'same-service') return; // let webview navigate normally

      event.preventDefault();
      if (!shouldHandle(url)) return;
      if (route === 'external') openExternalSafe(url);
      else mainWindow?.webContents.send('open-in-app-tab', url);
    });

    // Handle HTTP redirects (e.g. Gmail's google.com/url?q=…, Slack's slack-redir.net)
    webviewWebContents.on('will-redirect', (event: Electron.Event, url: string) => {
      const route = routeLink(url, webviewWebContents.getURL());
      console.log('[omatome] will-redirect:', url, '→', route);

      if (route === 'blocked') {
        event.preventDefault();
        return;
      }
      if (route === 'same-service') return;

      event.preventDefault();
      if (!shouldHandle(url)) return;
      if (route === 'external') openExternalSafe(url);
      else mainWindow?.webContents.send('open-in-app-tab', url);
    });
  });

  // Receive clicks captured by the webview preload (capture-phase anchor click).
  // The preload already preventDefault'd the click, so we just route it.
  ipcMain.on('webview:link-click', (event, payload: { href: string; sourceUrl: string }) => {
    const { href, sourceUrl } = payload || ({} as { href: string; sourceUrl: string });
    if (!href) return;
    const route = routeLink(href, sourceUrl || event.sender.getURL());
    console.log('[omatome] webview:link-click:', href, '→', route);

    if (route === 'blocked') return;
    if (!shouldHandle(href)) return;

    if (route === 'external') {
      openExternalSafe(href);
    } else if (route === 'in-app') {
      mainWindow?.webContents.send('open-in-app-tab', href);
    } else {
      // same-service: load inside the webview that emitted the click
      event.sender.loadURL(href);
    }
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
