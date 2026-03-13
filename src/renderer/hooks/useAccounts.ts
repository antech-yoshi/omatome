import { useState, useEffect, useCallback } from 'react';
import type { Account, Group } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';
import { ACCOUNT_COLORS } from '@shared/constants';

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [savedAccounts, savedGroups, appState] = await Promise.all([
        window.electronAPI.getAccounts(),
        window.electronAPI.getGroups(),
        window.electronAPI.getAppState(),
      ]);
      const sorted = savedAccounts.sort((a, b) => a.order - b.order);
      setAccounts(sorted);
      setGroups(savedGroups.sort((a, b) => a.order - b.order));
      setActiveAccountId(appState.activeAccountId ?? sorted[0]?.id ?? null);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!loading) {
      window.electronAPI.saveAppState({ activeAccountId });
    }
  }, [activeAccountId, loading]);

  const addAccount = useCallback(
    async (serviceId: string, label: string, opts?: { groupId?: string; customUrl?: string }) => {
      const account: Account = {
        id: uuidv4(),
        serviceId,
        label,
        order: accounts.length,
        partitionKey: uuidv4(),
        groupId: opts?.groupId,
        customUrl: opts?.customUrl,
      };
      const updated = await window.electronAPI.addAccount(account);
      const sorted = updated.sort((a, b) => a.order - b.order);
      setAccounts(sorted);
      setActiveAccountId(account.id);
      return account;
    },
    [accounts.length]
  );

  const removeAccount = useCallback(
    async (accountId: string) => {
      const updated = await window.electronAPI.removeAccount(accountId);
      const sorted = updated.sort((a, b) => a.order - b.order);
      setAccounts(sorted);
      if (activeAccountId === accountId) {
        setActiveAccountId(sorted[0]?.id ?? null);
      }
    },
    [activeAccountId]
  );

  const updateAccount = useCallback(async (account: Account) => {
    const updated = await window.electronAPI.updateAccount(account);
    const sorted = updated.sort((a, b) => a.order - b.order);
    setAccounts(sorted);
  }, []);

  const switchAccount = useCallback(
    (accountId: string) => {
      if (accounts.find((a) => a.id === accountId)) {
        setActiveAccountId(accountId);
      }
    },
    [accounts]
  );

  const switchToIndex = useCallback(
    (index: number) => {
      // Match the visual ordering in Sidebar: ungrouped first, then grouped by group order
      const ungrouped = accounts.filter((a) => !a.groupId);
      const grouped = groups.flatMap((g) => accounts.filter((a) => a.groupId === g.id));
      const flat = [...ungrouped, ...grouped];
      if (index >= 0 && index < flat.length) {
        setActiveAccountId(flat[index].id);
      }
    },
    [accounts, groups]
  );

  const switchNext = useCallback(() => {
    if (accounts.length === 0) return;
    const currentIndex = accounts.findIndex((a) => a.id === activeAccountId);
    const nextIndex = (currentIndex + 1) % accounts.length;
    setActiveAccountId(accounts[nextIndex].id);
  }, [accounts, activeAccountId]);

  const switchPrev = useCallback(() => {
    if (accounts.length === 0) return;
    const currentIndex = accounts.findIndex((a) => a.id === activeAccountId);
    const prevIndex = (currentIndex - 1 + accounts.length) % accounts.length;
    setActiveAccountId(accounts[prevIndex].id);
  }, [accounts, activeAccountId]);

  // Group management
  const addGroup = useCallback(
    async (name: string) => {
      const group: Group = {
        id: uuidv4(),
        name,
        color: ACCOUNT_COLORS[groups.length % ACCOUNT_COLORS.length],
        order: groups.length,
      };
      const updated = await window.electronAPI.addGroup(group);
      setGroups(updated.sort((a, b) => a.order - b.order));
      return group;
    },
    [groups.length]
  );

  const updateGroup = useCallback(async (group: Group) => {
    const updated = await window.electronAPI.updateGroup(group);
    setGroups(updated.sort((a, b) => a.order - b.order));
  }, []);

  const removeGroup = useCallback(async (groupId: string) => {
    const { groups: updatedGroups, accounts: updatedAccounts } =
      await window.electronAPI.removeGroup(groupId);
    setGroups(updatedGroups.sort((a, b) => a.order - b.order));
    setAccounts(updatedAccounts.sort((a, b) => a.order - b.order));
  }, []);

  const reorderAccounts = useCallback(async (orderedIds: string[]) => {
    const updated = await window.electronAPI.reorderAccounts(orderedIds);
    setAccounts(updated.sort((a, b) => a.order - b.order));
  }, []);

  const reorderGroups = useCallback(async (orderedIds: string[]) => {
    const updated = await window.electronAPI.reorderGroups(orderedIds);
    setGroups(updated.sort((a, b) => a.order - b.order));
  }, []);

  const clearSession = useCallback(async (accountId: string) => {
    await window.electronAPI.clearSession(accountId);
  }, []);

  return {
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
  };
}
