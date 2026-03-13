import React, { useEffect, useRef } from 'react';
import type { Account, EphemeralTab } from '@shared/types';
import { PRESET_SERVICES } from '@shared/constants';

interface WebViewContainerProps {
  accounts: Account[];
  ephemeralTabs: EphemeralTab[];
  activeAccountId: string | null;
  activeEphemeralTabId: string | null;
  lastUrls: Record<string, string>;
  onUrlChange: (accountId: string, url: string) => void;
}

export default function WebViewContainer({
  accounts,
  ephemeralTabs,
  activeAccountId,
  activeEphemeralTabId,
  lastUrls,
  onUrlChange,
}: WebViewContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const webviewRefs = useRef<Map<string, Electron.WebviewTag>>(new Map());

  const getServiceUrl = (account: Account): string => {
    if (account.customUrl) return account.customUrl;
    return PRESET_SERVICES.find((s) => s.id === account.serviceId)?.url ?? `https://${account.serviceId}`;
  };

  // Manage account webviews
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    for (const account of accounts) {
      if (!webviewRefs.current.has(account.id)) {
        const webview = document.createElement('webview') as Electron.WebviewTag;
        // Restore last visited URL or use service default
        const savedUrl = lastUrls[account.id];
        webview.src = savedUrl || getServiceUrl(account);
        webview.partition = `persist:${account.partitionKey}`;
        webview.setAttribute('allowpopups', '');
        webview.style.width = '100%';
        webview.style.height = '100%';
        webview.style.position = 'absolute';
        webview.style.inset = '0';
        webview.style.display = 'none';

        // Track URL changes to persist last visited page
        const accountId = account.id;
        webview.addEventListener('did-navigate', (e: any) => {
          if (e.url && e.url.startsWith('http')) {
            onUrlChange(accountId, e.url);
          }
        });
        webview.addEventListener('did-navigate-in-page', (e: any) => {
          if (e.url && e.url.startsWith('http')) {
            onUrlChange(accountId, e.url);
          }
        });

        container.appendChild(webview);
        webviewRefs.current.set(account.id, webview);
      }
    }

    // Remove webviews for deleted accounts (skip ephemeral)
    const currentIds = new Set(accounts.map((a) => a.id));
    for (const [id, webview] of webviewRefs.current.entries()) {
      if (!currentIds.has(id) && !id.startsWith('eph-')) {
        webview.remove();
        webviewRefs.current.delete(id);
      }
    }
  }, [accounts]);

  // Manage ephemeral tab webviews
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    for (const tab of ephemeralTabs) {
      if (!webviewRefs.current.has(tab.id)) {
        const webview = document.createElement('webview') as Electron.WebviewTag;
        webview.src = tab.url;
        webview.partition = `persist:${tab.partitionKey}`;
        webview.setAttribute('allowpopups', '');
        webview.style.width = '100%';
        webview.style.height = '100%';
        webview.style.position = 'absolute';
        webview.style.inset = '0';
        webview.style.display = 'none';

        container.appendChild(webview);
        webviewRefs.current.set(tab.id, webview);
      }
    }

    // Remove deleted ephemeral webviews
    const ephIds = new Set(ephemeralTabs.map((t) => t.id));
    for (const [id, webview] of webviewRefs.current.entries()) {
      if (id.startsWith('eph-') && !ephIds.has(id)) {
        webview.remove();
        webviewRefs.current.delete(id);
      }
    }
  }, [ephemeralTabs]);

  // Show/hide webviews
  useEffect(() => {
    const activeId = activeEphemeralTabId ?? activeAccountId;
    for (const [id, webview] of webviewRefs.current.entries()) {
      webview.style.display = id === activeId ? 'flex' : 'none';
    }
  }, [activeAccountId, activeEphemeralTabId]);

  // Shortcut handlers
  useEffect(() => {
    const getActiveWebview = () => {
      const activeId = activeEphemeralTabId ?? activeAccountId;
      return activeId ? webviewRefs.current.get(activeId) : undefined;
    };
    const handleReload = () => getActiveWebview()?.reload();
    const handleBack = () => {
      const wv = getActiveWebview();
      if (wv?.canGoBack()) wv.goBack();
    };
    const handleForward = () => {
      const wv = getActiveWebview();
      if (wv?.canGoForward()) wv.goForward();
    };

    window.electronAPI.onShortcut('shortcut:reload', handleReload);
    window.electronAPI.onShortcut('shortcut:back', handleBack);
    window.electronAPI.onShortcut('shortcut:forward', handleForward);

    return () => {
      window.electronAPI.removeShortcutListener('shortcut:reload');
      window.electronAPI.removeShortcutListener('shortcut:back');
      window.electronAPI.removeShortcutListener('shortcut:forward');
    };
  }, [activeAccountId, activeEphemeralTabId]);

  if (accounts.length === 0 && ephemeralTabs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <svg className="w-20 h-20 mx-auto text-gray-200 dark:text-gray-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <h2 className="text-xl font-medium text-gray-400 dark:text-gray-500 mb-2">No services added</h2>
          <p className="text-sm text-gray-300 dark:text-gray-600">Click the + button in the sidebar to add a service</p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="flex-1 relative bg-white dark:bg-gray-900" />;
}
