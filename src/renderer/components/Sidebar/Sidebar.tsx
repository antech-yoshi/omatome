import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Account, Group, EphemeralTab } from '@shared/types';
import { PRESET_SERVICES } from '@shared/constants';
import ServiceIcon from '../ServiceIcon';

interface SidebarProps {
  accounts: Account[];
  groups: Group[];
  ephemeralTabs: EphemeralTab[];
  activeAccountId: string | null;
  activeEphemeralTabId: string | null;
  collapsed: boolean;
  onSelectAccount: (accountId: string) => void;
  onSelectEphemeralTab: (tabId: string) => void;
  onCloseEphemeralTab: (tabId: string) => void;
  onAddAccount: () => void;
  onAddGroup: (name: string) => void;
  onUpdateAccount: (account: Account) => void;
  onEditAccount: (account: Account) => void;
  onEditGroup: (group: Group) => void;
  onReorderAccounts: (orderedIds: string[]) => void;
  onReorderGroups: (orderedIds: string[]) => void;
}

type DropIndicator = {
  accountId: string;
  position: 'before' | 'after';
} | null;

export default function Sidebar({
  accounts,
  groups,
  ephemeralTabs,
  activeAccountId,
  activeEphemeralTabId,
  collapsed,
  onSelectAccount,
  onSelectEphemeralTab,
  onCloseEphemeralTab,
  onAddAccount,
  onAddGroup,
  onUpdateAccount,
  onEditAccount,
  onEditGroup,
  onReorderAccounts,
  onReorderGroups,
}: SidebarProps) {
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [groupName, setGroupName] = useState('');

  // D&D state
  const [dragType, setDragType] = useState<'account' | 'group' | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator>(null);
  const [dropGroupTarget, setDropGroupTarget] = useState<string | null>(null);
  const [dragGroupReorderTarget, setDragGroupReorderTarget] = useState<string | null>(null);
  const dragEnterCounterRef = useRef(0);
  const groupDragCounterRef = useRef<Map<string, number>>(new Map());

  const UNGROUPED = '__ungrouped__';

  // Detect ⌘ key held down to show shortcut badges
  const [metaHeld, setMetaHeld] = useState(false);

  useEffect(() => {
    // Listen for meta key state from main process (works even when webview has focus)
    window.electronAPI.onShortcut('meta-key:down', () => setMetaHeld(true));
    window.electronAPI.onShortcut('meta-key:up', () => setMetaHeld(false));

    const handleBlur = () => setMetaHeld(false);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.electronAPI.removeShortcutListener('meta-key:down');
      window.electronAPI.removeShortcutListener('meta-key:up');
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Fallback: detect ⌘ release via mouse/keyboard events in renderer
  // When webview has focus, before-input-event may not fire for standalone Meta keyUp.
  // But mouse events on the renderer (sidebar) area DO include the current metaKey state.
  useEffect(() => {
    if (!metaHeld) return;

    const checkMeta = (e: MouseEvent | KeyboardEvent) => {
      if (!e.metaKey) setMetaHeld(false);
    };

    document.addEventListener('mousemove', checkMeta, true);
    document.addEventListener('mousedown', checkMeta, true);
    document.addEventListener('keydown', checkMeta, true);
    document.addEventListener('keyup', checkMeta, true);

    // Ultimate fallback: auto-hide after 5 seconds
    const timer = setTimeout(() => setMetaHeld(false), 5000);

    return () => {
      document.removeEventListener('mousemove', checkMeta, true);
      document.removeEventListener('mousedown', checkMeta, true);
      document.removeEventListener('keydown', checkMeta, true);
      document.removeEventListener('keyup', checkMeta, true);
      clearTimeout(timer);
    };
  }, [metaHeld]);

  const getServiceName = (serviceId: string): string => {
    return PRESET_SERVICES.find((s) => s.id === serviceId)?.name ?? serviceId;
  };

  const handleAddGroup = () => {
    if (groupName.trim()) {
      onAddGroup(groupName.trim());
      setGroupName('');
      setShowGroupInput(false);
    }
  };

  // Build ordered list: ungrouped first, then each group's accounts in order
  const ungroupedAccounts = accounts.filter((a) => !a.groupId);
  const groupedSections = groups.map((group) => ({
    group,
    accounts: accounts.filter((a) => a.groupId === group.id),
  }));

  // For keyboard shortcut index
  const flatAccounts = [
    ...ungroupedAccounts,
    ...groupedSections.flatMap((s) => s.accounts),
  ];
  const getGlobalIndex = (accountId: string) =>
    flatAccounts.findIndex((a) => a.id === accountId);

  // Get the groupId for a given account list context
  const getGroupIdForSection = (accountId: string): string | undefined => {
    const account = accounts.find((a) => a.id === accountId);
    return account?.groupId;
  };

  // ====== Account D&D ======
  const handleAccountDragStart = useCallback((e: React.DragEvent, accountId: string) => {
    setDragType('account');
    setDragId(accountId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', accountId);
    // Make drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.4';
    }
  }, []);

  const handleAccountDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '';
    }
    setDragType(null);
    setDragId(null);
    setDropIndicator(null);
    setDropGroupTarget(null);
    setDragGroupReorderTarget(null);
    dragEnterCounterRef.current = 0;
    groupDragCounterRef.current.clear();
  }, []);

  const handleAccountDragOver = useCallback((e: React.DragEvent, accountId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    // Calculate drop position based on mouse Y
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'before' : 'after';
    setDropIndicator({ accountId, position });
  }, []);

  const handleAccountDrop = useCallback(
    (e: React.DragEvent, targetAccountId: string) => {
      e.preventDefault();
      e.stopPropagation();

      if (dragType !== 'account' || !dragId || dragId === targetAccountId) {
        setDropIndicator(null);
        return;
      }

      const targetAccount = accounts.find((a) => a.id === targetAccountId);
      if (!targetAccount) return;

      // Determine the target groupId
      const targetGroupId = targetAccount.groupId;

      // Determine position
      const rect = e.currentTarget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const insertAfter = e.clientY >= midY;

      // Get accounts in the target section
      const sectionAccounts = targetGroupId
        ? accounts.filter((a) => a.groupId === targetGroupId)
        : accounts.filter((a) => !a.groupId);

      // Build new full account order
      const draggedAccount = accounts.find((a) => a.id === dragId);
      if (!draggedAccount) return;

      // Update groupId if moving to a different group
      if (draggedAccount.groupId !== targetGroupId) {
        onUpdateAccount({ ...draggedAccount, groupId: targetGroupId });
      }

      // Build ordered IDs: remove dragged, then insert at position
      const allIds = accounts.map((a) => a.id).filter((id) => id !== dragId);
      const targetIdx = allIds.indexOf(targetAccountId);
      const insertIdx = insertAfter ? targetIdx + 1 : targetIdx;
      allIds.splice(insertIdx, 0, dragId);

      onReorderAccounts(allIds);
      setDropIndicator(null);
    },
    [dragType, dragId, accounts, onUpdateAccount, onReorderAccounts]
  );

  // Drop on empty group zone
  const handleDropOnEmptyGroup = useCallback(
    (e: React.DragEvent, groupId: string | null) => {
      e.preventDefault();
      e.stopPropagation();

      if (dragType !== 'account' || !dragId) return;

      const draggedAccount = accounts.find((a) => a.id === dragId);
      if (!draggedAccount) return;

      onUpdateAccount({ ...draggedAccount, groupId: groupId ?? undefined });
      setDropGroupTarget(null);
      setDropIndicator(null);
    },
    [dragType, dragId, accounts, onUpdateAccount]
  );

  // Group zone enter/leave with counter to prevent flicker
  const handleGroupZoneEnter = useCallback((e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    const counter = (groupDragCounterRef.current.get(groupId) ?? 0) + 1;
    groupDragCounterRef.current.set(groupId, counter);
    if (dragType === 'account') {
      setDropGroupTarget(groupId);
    }
  }, [dragType]);

  const handleGroupZoneLeave = useCallback((groupId: string) => {
    const counter = (groupDragCounterRef.current.get(groupId) ?? 0) - 1;
    groupDragCounterRef.current.set(groupId, Math.max(0, counter));
    if (counter <= 0) {
      setDropGroupTarget((prev) => (prev === groupId ? null : prev));
    }
  }, []);

  // ====== Group D&D (reorder) ======
  const handleGroupDragStart = useCallback((e: React.DragEvent, groupId: string) => {
    e.stopPropagation();
    setDragType('group');
    setDragId(groupId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', groupId);
  }, []);

  const handleGroupDragOver = useCallback((e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragType === 'group' && dragId !== targetGroupId) {
      setDragGroupReorderTarget(targetGroupId);
    }
  }, [dragType, dragId]);

  const handleGroupDrop = useCallback(
    (e: React.DragEvent, targetGroupId: string) => {
      e.preventDefault();
      e.stopPropagation();

      if (dragType !== 'group' || !dragId || dragId === targetGroupId) return;

      const orderedIds = groups.map((g) => g.id);
      const sourceIdx = orderedIds.indexOf(dragId);
      const targetIdx = orderedIds.indexOf(targetGroupId);
      if (sourceIdx === -1 || targetIdx === -1) return;

      orderedIds.splice(sourceIdx, 1);
      orderedIds.splice(targetIdx, 0, dragId);
      onReorderGroups(orderedIds);

      setDragGroupReorderTarget(null);
    },
    [dragType, dragId, groups, onReorderGroups]
  );

  // ====== Ephemeral tabs ======
  const getEphemeralTabsForAccount = (accountId: string) =>
    ephemeralTabs.filter((t) => t.parentAccountId === accountId);

  const renderEphemeralTab = (tab: EphemeralTab) => {
    const isActive = tab.id === activeEphemeralTabId;
    let displayTitle = tab.title;
    try {
      displayTitle = new URL(tab.url).hostname;
    } catch { /* keep original */ }

    return (
      <div key={tab.id} className="flex items-center">
        <button
          onClick={() => onSelectEphemeralTab(tab.id)}
          title={tab.url}
          className={`titlebar-no-drag flex-1 flex items-center gap-2 rounded-md pl-6 pr-1 py-1 transition-colors relative ${
            isActive ? 'bg-gray-200/80 dark:bg-gray-600/50' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
          }`}
        >
          {isActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3 rounded-r bg-gray-400" />
          )}
          <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          {!collapsed && (
            <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate flex-1 text-left">
              {displayTitle}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCloseEphemeralTab(tab.id);
            }}
            className="p-0.5 text-gray-300 hover:text-gray-600 transition-colors shrink-0"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </button>
      </div>
    );
  };

  // ====== Account item ======
  const renderAccountItem = (account: Account) => {
    const isActive = account.id === activeAccountId && !activeEphemeralTabId;
    const isDragging = account.id === dragId && dragType === 'account';
    const globalIdx = getGlobalIndex(account.id);
    const accountGroup = groups.find((g) => g.id === account.groupId);
    const accountEphTabs = getEphemeralTabsForAccount(account.id);

    const showBefore = dropIndicator?.accountId === account.id && dropIndicator.position === 'before';
    const showAfter = dropIndicator?.accountId === account.id && dropIndicator.position === 'after';

    return (
      <div key={account.id}>
        {/* Drop indicator line - before */}
        {showBefore && (
          <div className="h-0.5 mx-1 bg-indigo-400 rounded-full" />
        )}

        <div
          draggable
          onDragStart={(e) => handleAccountDragStart(e, account.id)}
          onDragEnd={handleAccountDragEnd}
          onDragOver={(e) => handleAccountDragOver(e, account.id)}
          onDrop={(e) => handleAccountDrop(e, account.id)}
          className={`transition-opacity ${isDragging ? 'opacity-30' : ''}`}
        >
          <button
            onClick={() => onSelectAccount(account.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEditAccount(account);
            }}
            title={`${account.label} — ${getServiceName(account.serviceId)}${globalIdx < 9 ? ` (⌘${globalIdx + 1})` : ''}`}
            className={`titlebar-no-drag w-full flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors relative group cursor-grab active:cursor-grabbing ${
              isActive ? 'bg-gray-200/80 dark:bg-gray-600/50' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
            }`}
          >
            {isActive && (
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r bg-gray-400"
                style={accountGroup ? { backgroundColor: accountGroup.color } : undefined}
              />
            )}
            <div className="relative shrink-0">
              <ServiceIcon serviceId={account.serviceId} customUrl={account.customUrl} className="w-5 h-5" />
              {metaHeld && globalIdx < 10 && (
                <div className="absolute -top-1 -right-1.5 w-3.5 h-3.5 flex items-center justify-center rounded bg-gray-800 text-white text-[9px] font-bold leading-none shadow-sm z-10">
                  {globalIdx === 9 ? '0' : `${globalIdx + 1}`}
                </div>
              )}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0 text-left">
                <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate leading-tight">
                  {account.label}
                </div>
                <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate leading-tight">
                  {getServiceName(account.serviceId)}
                </div>
              </div>
            )}
          </button>
        </div>

        {/* Drop indicator line - after */}
        {showAfter && (
          <div className="h-0.5 mx-1 bg-indigo-400 rounded-full" />
        )}

        {/* Ephemeral tabs for this account */}
        {accountEphTabs.length > 0 && (
          <div className="space-y-0.5">
            {accountEphTabs.map(renderEphemeralTab)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`h-full flex flex-col border-r border-gray-200 dark:border-gray-700 bg-[#FAFAFA] dark:bg-gray-800 transition-all duration-200 ${
        collapsed ? 'w-12' : 'w-[180px]'
      }`}
    >
      <div className="titlebar-drag h-10 shrink-0" />

      <div className="flex-1 overflow-y-auto px-1 space-y-0.5">
        {/* Ungrouped drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDragEnter={(e) => handleGroupZoneEnter(e, UNGROUPED)}
          onDragLeave={() => handleGroupZoneLeave(UNGROUPED)}
          onDrop={(e) => handleDropOnEmptyGroup(e, null)}
          className={`rounded-md transition-colors min-h-[4px] ${
            dropGroupTarget === UNGROUPED && dragType === 'account' && ungroupedAccounts.length === 0
              ? 'bg-indigo-50 ring-1 ring-indigo-300 min-h-[32px]'
              : ''
          }`}
        >
          {ungroupedAccounts.map(renderAccountItem)}
        </div>

        {/* Grouped accounts */}
        {groupedSections.map(({ group, accounts: groupAccounts }) => {
          const isGroupHighlight = dropGroupTarget === group.id && dragType === 'account';
          const isGroupDragging = dragId === group.id && dragType === 'group';
          const isGroupReorderTarget = dragGroupReorderTarget === group.id && dragType === 'group';
          return (
            <div
              key={group.id}
              className={`mt-1 first:mt-0 rounded-md transition-all ${
                isGroupHighlight ? 'bg-indigo-50 ring-1 ring-indigo-300' : ''
              } ${isGroupDragging ? 'opacity-30' : ''} ${
                isGroupReorderTarget ? 'border-t-2 border-indigo-400' : ''
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragType === 'group' && dragId !== group.id) {
                  handleGroupDragOver(e, group.id);
                }
              }}
              onDragEnter={(e) => handleGroupZoneEnter(e, group.id)}
              onDragLeave={() => handleGroupZoneLeave(group.id)}
              onDrop={(e) => {
                if (dragType === 'group') {
                  handleGroupDrop(e, group.id);
                } else {
                  handleDropOnEmptyGroup(e, group.id);
                }
              }}
            >
              {!collapsed ? (
                <div
                  draggable
                  onDragStart={(e) => handleGroupDragStart(e, group.id)}
                  onDragEnd={handleAccountDragEnd}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEditGroup(group);
                  }}
                  className="flex items-center gap-1.5 px-1.5 py-1 mt-0.5 cursor-grab active:cursor-grabbing"
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider truncate">
                    {group.name}
                  </span>
                </div>
              ) : (
                <div
                  draggable
                  onDragStart={(e) => handleGroupDragStart(e, group.id)}
                  onDragEnd={handleAccountDragEnd}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEditGroup(group);
                  }}
                  className="flex justify-center py-1 mt-0.5 cursor-grab active:cursor-grabbing"
                >
                  <div
                    className="w-5 h-0.5 rounded-full"
                    style={{ backgroundColor: group.color }}
                    title={group.name}
                  />
                </div>
              )}
              <div className={`space-y-0.5 ${groupAccounts.length === 0 ? 'min-h-[24px]' : ''}`}>
                {groupAccounts.map(renderAccountItem)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom actions */}
      <div className="p-1.5 border-t border-gray-200 dark:border-gray-700 space-y-0.5">
        {showGroupInput && !collapsed && (
          <div className="flex gap-1">
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddGroup();
                if (e.key === 'Escape') {
                  setShowGroupInput(false);
                  setGroupName('');
                }
              }}
              placeholder="Group name"
              className="flex-1 min-w-0 px-2 py-1 text-[11px] border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
              autoFocus
            />
            <button
              onClick={handleAddGroup}
              className="px-2 py-1 text-[11px] font-medium text-white bg-indigo-500 rounded-md hover:bg-indigo-600 transition-colors"
            >
              OK
            </button>
          </div>
        )}

        <button
          onClick={() => {
            if (collapsed) {
              const name = prompt('Group name:');
              if (name?.trim()) onAddGroup(name.trim());
            } else {
              setShowGroupInput(!showGroupInput);
            }
          }}
          className="titlebar-no-drag w-full flex items-center justify-center gap-1.5 rounded-md px-1.5 py-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Add Group"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44z" />
          </svg>
          {!collapsed && <span className="text-[11px]">Add Group</span>}
        </button>

        <button
          onClick={onAddAccount}
          className="titlebar-no-drag w-full flex items-center justify-center gap-1.5 rounded-md px-1.5 py-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {!collapsed && <span className="text-xs">Add Service</span>}
        </button>
      </div>
    </div>
  );
}
