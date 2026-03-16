import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  pointerWithin,
  rectIntersection,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Account, Group, EphemeralTab } from '@shared/types';
import { PRESET_SERVICES } from '@shared/constants';
import ServiceIcon from '../ServiceIcon';
import SortableAccountItem from './SortableAccountItem';
import SortableGroupSection from './SortableGroupSection';

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

function UngroupedDropZone({
  isAccountDragging,
  children,
}: {
  isAccountDragging: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'ungrouped-zone',
    disabled: !isAccountDragging,
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-md transition-colors min-h-[4px] ${
        isOver && isAccountDragging ? 'bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-300 min-h-[32px]' : ''
      }`}
    >
      {children}
    </div>
  );
}

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
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<'account' | 'group' | null>(null);

  // Detect ⌘ key held down to show shortcut badges
  const [metaHeld, setMetaHeld] = useState(false);

  useEffect(() => {
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

  useEffect(() => {
    if (!metaHeld) return;

    const checkMeta = (e: MouseEvent | KeyboardEvent) => {
      if (!e.metaKey) setMetaHeld(false);
    };

    document.addEventListener('mousemove', checkMeta, true);
    document.addEventListener('mousedown', checkMeta, true);
    document.addEventListener('keydown', checkMeta, true);
    document.addEventListener('keyup', checkMeta, true);

    const timer = setTimeout(() => setMetaHeld(false), 5000);

    return () => {
      document.removeEventListener('mousemove', checkMeta, true);
      document.removeEventListener('mousedown', checkMeta, true);
      document.removeEventListener('keydown', checkMeta, true);
      document.removeEventListener('keyup', checkMeta, true);
      clearTimeout(timer);
    };
  }, [metaHeld]);

  const handleAddGroup = () => {
    if (groupName.trim()) {
      onAddGroup(groupName.trim());
      setGroupName('');
      setShowGroupInput(false);
    }
  };

  // Build ordered lists
  const ungroupedAccounts = accounts.filter((a) => !a.groupId);
  const groupedSections = groups.map((group) => ({
    group,
    accounts: accounts.filter((a) => a.groupId === group.id),
  }));

  const flatAccounts = useMemo(
    () => [...ungroupedAccounts, ...groupedSections.flatMap((s) => s.accounts)],
    [accounts, groups]
  );
  const getGlobalIndex = (accountId: string) =>
    flatAccounts.findIndex((a) => a.id === accountId);

  // Sortable IDs
  const allAccountIds = useMemo(() => flatAccounts.map((a) => a.id), [flatAccounts]);
  const allGroupSortableIds = useMemo(
    () => groups.map((g) => `group:${g.id}`),
    [groups]
  );

  // Sensors: require 5px movement before drag starts (prevents accidental drags on click)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const isAccountDragging = dragType === 'account';

  // ====== DnD Handlers ======
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveDragId(id);
    if (id.startsWith('group:')) {
      setDragType('group');
    } else {
      setDragType('account');
    }
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      if (dragType !== 'account') return;

      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // If dragging over a group zone, update groupId
      if (overId.startsWith('group-zone:')) {
        const targetGroupId = overId.replace('group-zone:', '');
        const draggedAccount = accounts.find((a) => a.id === activeId);
        if (draggedAccount && draggedAccount.groupId !== targetGroupId) {
          onUpdateAccount({ ...draggedAccount, groupId: targetGroupId });
        }
        return;
      }

      if (overId === 'ungrouped-zone') {
        const draggedAccount = accounts.find((a) => a.id === activeId);
        if (draggedAccount && draggedAccount.groupId) {
          onUpdateAccount({ ...draggedAccount, groupId: undefined });
        }
        return;
      }

      // Dragging over another account
      if (!overId.startsWith('group:') && activeId !== overId) {
        const draggedAccount = accounts.find((a) => a.id === activeId);
        const targetAccount = accounts.find((a) => a.id === overId);
        if (!draggedAccount || !targetAccount) return;

        // Move to different group if needed
        if (draggedAccount.groupId !== targetAccount.groupId) {
          onUpdateAccount({ ...draggedAccount, groupId: targetAccount.groupId });
        }

        // Reorder within the same group (live reorder during drag)
        const allIds = accounts.map((a) => a.id);
        const sourceIdx = allIds.indexOf(activeId);
        const targetIdx = allIds.indexOf(overId);
        if (sourceIdx !== -1 && targetIdx !== -1 && sourceIdx !== targetIdx) {
          allIds.splice(sourceIdx, 1);
          allIds.splice(targetIdx, 0, activeId);
          onReorderAccounts(allIds);
        }
      }
    },
    [dragType, accounts, onUpdateAccount, onReorderAccounts]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveDragId(null);
      setDragType(null);

      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Group reorder
      if (activeId.startsWith('group:') && overId.startsWith('group:')) {
        const fromId = activeId.replace('group:', '');
        const toId = overId.replace('group:', '');
        if (fromId !== toId) {
          const orderedIds = groups.map((g) => g.id);
          const sourceIdx = orderedIds.indexOf(fromId);
          const targetIdx = orderedIds.indexOf(toId);
          if (sourceIdx !== -1 && targetIdx !== -1) {
            orderedIds.splice(sourceIdx, 1);
            orderedIds.splice(targetIdx, 0, fromId);
            onReorderGroups(orderedIds);
          }
        }
        return;
      }

      // Account reorder / move
      if (!activeId.startsWith('group:')) {
        const draggedAccount = accounts.find((a) => a.id === activeId);
        if (!draggedAccount) return;

        // Dropped on a group zone
        if (overId.startsWith('group-zone:')) {
          const targetGroupId = overId.replace('group-zone:', '');
          if (draggedAccount.groupId !== targetGroupId) {
            onUpdateAccount({ ...draggedAccount, groupId: targetGroupId });
          }
          return;
        }

        // Dropped on ungrouped zone
        if (overId === 'ungrouped-zone') {
          if (draggedAccount.groupId) {
            onUpdateAccount({ ...draggedAccount, groupId: undefined });
          }
          return;
        }

        // Dropped on a group header (not zone)
        if (overId.startsWith('group:')) return;

        // Dropped on another account
        if (activeId !== overId) {
          const allIds = accounts.map((a) => a.id);
          const sourceIdx = allIds.indexOf(activeId);
          const targetIdx = allIds.indexOf(overId);
          if (sourceIdx !== -1 && targetIdx !== -1) {
            allIds.splice(sourceIdx, 1);
            allIds.splice(targetIdx, 0, activeId);
            onReorderAccounts(allIds);
          }
        }
      }
    },
    [groups, accounts, onReorderGroups, onReorderAccounts]
  );

  // Drag overlay content
  const activeDragAccount = activeDragId && !activeDragId.startsWith('group:')
    ? accounts.find((a) => a.id === activeDragId)
    : null;
  const activeDragGroup = activeDragId?.startsWith('group:')
    ? groups.find((g) => g.id === activeDragId.replace('group:', ''))
    : null;

  return (
    <div
      className={`h-full flex flex-col border-r border-gray-200 dark:border-gray-700 bg-[#FAFAFA] dark:bg-gray-800 transition-all duration-200 ${
        collapsed ? 'w-12' : 'w-[180px]'
      }`}
    >
      <div className="titlebar-drag h-10 shrink-0" />

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-y-auto px-1 space-y-0.5">
          <SortableContext items={allAccountIds} strategy={verticalListSortingStrategy}>
            <SortableContext items={allGroupSortableIds} strategy={verticalListSortingStrategy}>
              {/* Ungrouped accounts */}
              <UngroupedDropZone isAccountDragging={isAccountDragging}>
                {ungroupedAccounts.map((account) => (
                  <SortableAccountItem
                    key={account.id}
                    account={account}
                    isActive={account.id === activeAccountId && !activeEphemeralTabId}
                    globalIndex={getGlobalIndex(account.id)}
                    metaHeld={metaHeld}
                    collapsed={collapsed}
                    ephemeralTabs={ephemeralTabs}
                    activeEphemeralTabId={activeEphemeralTabId}
                    onSelectAccount={onSelectAccount}
                    onEditAccount={onEditAccount}
                    onSelectEphemeralTab={onSelectEphemeralTab}
                    onCloseEphemeralTab={onCloseEphemeralTab}
                  />
                ))}
              </UngroupedDropZone>

              {/* Grouped accounts */}
              {groupedSections.map(({ group, accounts: groupAccounts }) => (
                <SortableGroupSection
                  key={group.id}
                  group={group}
                  collapsed={collapsed}
                  isAccountDragging={isAccountDragging}
                  onEditGroup={onEditGroup}
                  hasAccounts={groupAccounts.length > 0}
                >
                  {groupAccounts.map((account) => (
                    <SortableAccountItem
                      key={account.id}
                      account={account}
                      isActive={account.id === activeAccountId && !activeEphemeralTabId}
                      globalIndex={getGlobalIndex(account.id)}
                      metaHeld={metaHeld}
                      collapsed={collapsed}
                      group={group}
                      ephemeralTabs={ephemeralTabs}
                      activeEphemeralTabId={activeEphemeralTabId}
                      onSelectAccount={onSelectAccount}
                      onEditAccount={onEditAccount}
                      onSelectEphemeralTab={onSelectEphemeralTab}
                      onCloseEphemeralTab={onCloseEphemeralTab}
                    />
                  ))}
                </SortableGroupSection>
              ))}
            </SortableContext>
          </SortableContext>
          {/* Extra space at bottom for easier last-group drop target */}
          <div className="h-8" />
        </div>

        {/* Drag overlay - floating ghost */}
        <DragOverlay>
          {activeDragAccount && (
            <div className="bg-white dark:bg-gray-800 rounded-md shadow-lg px-1.5 py-1.5 flex items-center gap-2 opacity-90 border border-gray-200 dark:border-gray-600 w-[170px]">
              <ServiceIcon serviceId={activeDragAccount.serviceId} customUrl={activeDragAccount.customUrl} className="w-5 h-5 shrink-0" />
              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate leading-tight">
                    {activeDragAccount.label}
                  </div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate leading-tight">
                    {PRESET_SERVICES.find((s) => s.id === activeDragAccount.serviceId)?.name ?? activeDragAccount.serviceId}
                  </div>
                </div>
              )}
            </div>
          )}
          {activeDragGroup && (
            <div className="bg-white dark:bg-gray-800 rounded-md shadow-lg px-2 py-1 flex items-center gap-1.5 opacity-90 border border-gray-200 dark:border-gray-600">
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: activeDragGroup.color }}
              />
              <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                {activeDragGroup.name}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

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
