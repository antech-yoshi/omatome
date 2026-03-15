import { app, dialog, shell, BrowserWindow } from 'electron';
import https from 'https';

const GITHUB_OWNER = 'antech-yoshi';
const GITHUB_REPO = 'omatome';

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  body?: string;
}

function fetchLatestRelease(): Promise<GitHubRelease | null> {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      headers: { 'User-Agent': `omatome/${app.getVersion()}` },
    };

    https.get(options, (res) => {
      if (res.statusCode !== 200) {
        console.log('[omatome] update check: HTTP', res.statusCode);
        resolve(null);
        res.resume();
        return;
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    }).on('error', (err) => {
      console.log('[omatome] update check error:', err.message);
      resolve(null);
    });
  });
}

function compareVersions(current: string, latest: string): boolean {
  const c = current.replace(/^v/, '').split('.').map(Number);
  const l = latest.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cv = c[i] ?? 0;
    const lv = l[i] ?? 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

function getMainWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? undefined;
}

async function showDialog(options: Electron.MessageBoxOptions): Promise<number> {
  const win = getMainWindow();
  const result = win
    ? await dialog.showMessageBox(win, options)
    : await dialog.showMessageBox(options);
  return result.response;
}

export async function checkForUpdates(silent = true): Promise<void> {
  console.log('[omatome] checking for updates... silent:', silent);

  const release = await fetchLatestRelease();
  if (!release) {
    if (!silent) {
      await showDialog({
        type: 'warning',
        title: 'Update Check',
        message: 'Could not check for updates.',
        detail: 'Please check your internet connection or try again later.',
        buttons: ['OK'],
      });
    }
    return;
  }

  const currentVersion = app.getVersion();
  const latestVersion = release.tag_name;

  console.log('[omatome] current:', currentVersion, 'latest:', latestVersion);

  if (!compareVersions(currentVersion, latestVersion)) {
    if (!silent) {
      await showDialog({
        type: 'info',
        title: 'No Updates',
        message: 'You\'re up to date!',
        detail: `Current version: v${currentVersion}`,
        buttons: ['OK'],
      });
    }
    return;
  }

  const response = await showDialog({
    type: 'info',
    title: 'Update Available',
    message: `New version available: ${latestVersion}`,
    detail: `Current version: v${currentVersion}\n\nDownload the new version and replace the app in /Applications.\nYour data and login sessions will be preserved.`,
    buttons: ['Download', 'Later'],
    defaultId: 0,
    cancelId: 1,
  });

  if (response === 0) {
    shell.openExternal(release.html_url);
  }
}
