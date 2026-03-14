import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import WebViewContainer from './components/WebViewContainer/WebViewContainer';
import ServiceAddModal from './components/ServiceAddModal/ServiceAddModal';
import AccountEditModal from './components/AccountEditModal/AccountEditModal';
import GroupEditModal from './components/GroupEditModal/GroupEditModal';
import Settings from './components/Settings/Settings';
import { useAccounts } from './hooks/useAccounts';
import { useShortcuts } from './hooks/useShortcuts';
import { useTheme } from './hooks/useTheme';
import type { Account, Group, AppSettings, EphemeralTab } from '@shared/types';

let ephemeralCounter = 0;

export default function App() {
  const {
    accounts,
    groups,
    activeAccountId,
    loading,
    addAccount,
    removeAccount,
    updateAccount,
    switchAccount,
    switchToIndex,
    switchNext,
    switchPrev,
    addGroup,
    updateGroup,
    removeGroup,
    reorderAccounts,
    reorderGroups,
    clearSession,
  } = useAccounts();

  // Refs to access current values in IPC callback without stale closures
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;
  const activeAccountIdRef = useRef(activeAccountId);
  activeAccountIdRef.current = activeAccountId;

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({ linkOpenBehavior: 'external-browser', appearance: 'system' });

  // Edit modals
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  // Ephemeral tabs (in-app link tabs, not persisted)
  const [ephemeralTabs, setEphemeralTabs] = useState<EphemeralTab[]>([]);
  const [activeEphemeralTabId, setActiveEphemeralTabId] = useState<string | null>(null);

  useEffect(() => {
    window.electronAPI.getAppState().then((state) => {
      setSidebarCollapsed(state.sidebarCollapsed ?? false);
    });
    window.electronAPI.getSettings().then(setSettings);

    // Listen for in-app tab requests from main process
    window.electronAPI.onShortcut('open-in-app-tab', (url: unknown) => {
      if (typeof url === 'string') {
        // Find the active account to use as parent
        const currentAccounts = accountsRef.current;
        const currentActiveId = activeAccountIdRef.current;
        const parent = currentAccounts.find((a) => a.id === currentActiveId);
        if (parent) {
          let title: string;
          try {
            title = new URL(url).hostname;
          } catch {
            title = url;
          }
          const tab: EphemeralTab = {
            id: `eph-${++ephemeralCounter}`,
            url,
            title,
            partitionKey: parent.partitionKey,
            parentAccountId: parent.id,
          };
          setEphemeralTabs((prev) => [...prev, tab]);
          setActiveEphemeralTabId(tab.id);
        }
      }
    });

    return () => {
      window.electronAPI.removeShortcutListener('open-in-app-tab');
    };
  }, []);

  useTheme(settings.appearance);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      window.electronAPI.saveAppState({ sidebarCollapsed: next });
      return next;
    });
  }, []);

  useShortcuts({
    onToggleSidebar: toggleSidebar,
    onReload: () => {},
    onBack: () => {},
    onForward: () => {},
    onNextAccount: switchNext,
    onPrevAccount: switchPrev,
    onSwitchAccount: switchToIndex,
    onSettings: () => setShowSettings(true),
  });

  const handleAddAccount = useCallback(
    async (serviceId: string, label: string, customUrl?: string) => {
      await addAccount(serviceId, label, customUrl ? { customUrl } : undefined);
    },
    [addAccount]
  );

  const handleUpdateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const updated = await window.electronAPI.updateSettings(partial);
    setSettings(updated);
  }, []);

  // Open a URL as a new ephemeral tab next to the parent account
  const handleOpenInAppTab = useCallback((url: string, parentAccountId: string) => {
    const parentAccount = accounts.find((a) => a.id === parentAccountId);
    if (!parentAccount) return;

    let title: string;
    try {
      title = new URL(url).hostname;
    } catch {
      title = url;
    }

    const tab: EphemeralTab = {
      id: `eph-${++ephemeralCounter}`,
      url,
      title,
      partitionKey: parentAccount.partitionKey,
      parentAccountId,
    };

    setEphemeralTabs((prev) => [...prev, tab]);
    setActiveEphemeralTabId(tab.id);
  }, [accounts]);

  const handleSelectAccount = useCallback((accountId: string) => {
    switchAccount(accountId);
    setActiveEphemeralTabId(null);
  }, [switchAccount]);

  const handleSelectEphemeralTab = useCallback((tabId: string) => {
    setActiveEphemeralTabId(tabId);
  }, []);

  const handleCloseEphemeralTab = useCallback((tabId: string) => {
    setEphemeralTabs((prev) => prev.filter((t) => t.id !== tabId));
    if (activeEphemeralTabId === tabId) {
      setActiveEphemeralTabId(null);
    }
  }, [activeEphemeralTabId]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-gray-300 dark:text-gray-600 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-white dark:bg-gray-900">
      <Sidebar
        accounts={accounts}
        groups={groups}
        ephemeralTabs={ephemeralTabs}
        activeAccountId={activeAccountId}
        activeEphemeralTabId={activeEphemeralTabId}
        collapsed={sidebarCollapsed}
        onSelectAccount={handleSelectAccount}
        onSelectEphemeralTab={handleSelectEphemeralTab}
        onCloseEphemeralTab={handleCloseEphemeralTab}
        onAddAccount={() => setShowAddModal(true)}
        onAddGroup={addGroup}
        onUpdateAccount={updateAccount}
        onEditAccount={setEditingAccount}
        onEditGroup={setEditingGroup}
        onReorderAccounts={reorderAccounts}
        onReorderGroups={reorderGroups}
      />

      <WebViewContainer
        accounts={accounts}
        ephemeralTabs={ephemeralTabs}
        activeAccountId={activeAccountId}
        activeEphemeralTabId={activeEphemeralTabId}
      />

      <ServiceAddModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddAccount}
      />

      <AccountEditModal
        account={editingAccount}
        onClose={() => setEditingAccount(null)}
        onUpdate={updateAccount}
        onDelete={removeAccount}
        onClearSession={clearSession}
      />

      <GroupEditModal
        group={editingGroup}
        onClose={() => setEditingGroup(null)}
        onUpdate={updateGroup}
        onDelete={removeGroup}
      />

      <Settings
        isOpen={showSettings}
        settings={settings}
        onClose={() => setShowSettings(false)}
        onUpdateSettings={handleUpdateSettings}
      />
    </div>
  );
}
