import { app, dialog, shell, BrowserWindow } from 'electron';
import https from 'https';

// GitHub repository owner/name — update this after creating the repo
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
    }).on('error', () => resolve(null));
  });
}

function compareVersions(current: string, latest: string): boolean {
  // Returns true if latest > current
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

export async function checkForUpdates(silent = true): Promise<void> {
  const release = await fetchLatestRelease();
  if (!release) {
    if (!silent) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Check',
        message: 'Could not check for updates.',
        detail: 'Please check your internet connection or try again later.',
      });
    }
    return;
  }

  const currentVersion = app.getVersion();
  const latestVersion = release.tag_name;

  if (!compareVersions(currentVersion, latestVersion)) {
    if (!silent) {
      dialog.showMessageBox({
        type: 'info',
        title: 'No Updates',
        message: `You're on the latest version (v${currentVersion}).`,
      });
    }
    return;
  }

  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;

  const { response } = await dialog.showMessageBox(win ? { ...win } as any : {}, {
    type: 'info',
    title: 'Update Available',
    message: `New version available: ${latestVersion}`,
    detail: `Current version: v${currentVersion}\n\n${release.body ?? 'A new version is available.'}\n\nDownload and replace the app in /Applications.\nYour data and login sessions will be preserved.`,
    buttons: ['Download', 'Later'],
    defaultId: 0,
    cancelId: 1,
  });

  if (response === 0) {
    shell.openExternal(release.html_url);
  }
}
