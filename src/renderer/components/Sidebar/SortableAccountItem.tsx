import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Account, Group, EphemeralTab } from '@shared/types';
import { PRESET_SERVICES } from '@shared/constants';
import ServiceIcon from '../ServiceIcon';

interface SortableAccountItemProps {
  account: Account;
  isActive: boolean;
  globalIndex: number;
  metaHeld: boolean;
  collapsed: boolean;
  group?: Group;
  ephemeralTabs: EphemeralTab[];
  activeEphemeralTabId: string | null;
  onSelectAccount: (accountId: string) => void;
  onEditAccount: (account: Account) => void;
  onSelectEphemeralTab: (tabId: string) => void;
  onCloseEphemeralTab: (tabId: string) => void;
}

export default function SortableAccountItem({
  account,
  isActive,
  globalIndex,
  metaHeld,
  collapsed,
  group,
  ephemeralTabs,
  activeEphemeralTabId,
  onSelectAccount,
  onEditAccount,
  onSelectEphemeralTab,
  onCloseEphemeralTab,
}: SortableAccountItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: account.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : undefined,
  };

  const serviceName = PRESET_SERVICES.find((s) => s.id === account.serviceId)?.name ?? account.serviceId;
  const accountEphTabs = ephemeralTabs.filter((t) => t.parentAccountId === account.id);

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div {...listeners}>
        <button
          onClick={() => onSelectAccount(account.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEditAccount(account);
          }}
          title={`${account.label} — ${serviceName}${globalIndex < 9 ? ` (⌘${globalIndex + 1})` : ''}`}
          className={`titlebar-no-drag w-full flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors relative group cursor-grab active:cursor-grabbing ${
            isActive ? 'bg-gray-200/80 dark:bg-gray-600/50' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
          }`}
        >
          {isActive && (
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r bg-gray-400"
              style={group ? { backgroundColor: group.color } : undefined}
            />
          )}
          <div className="relative shrink-0">
            <ServiceIcon serviceId={account.serviceId} customUrl={account.customUrl} className="w-5 h-5" />
            {metaHeld && globalIndex < 10 && (
              <div className="absolute -top-1 -right-1.5 w-3.5 h-3.5 flex items-center justify-center rounded bg-gray-800 text-white text-[9px] font-bold leading-none shadow-sm z-10">
                {globalIndex === 9 ? '0' : `${globalIndex + 1}`}
              </div>
            )}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0 text-left">
              <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate leading-tight">
                {account.label}
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate leading-tight">
                {serviceName}
              </div>
            </div>
          )}
        </button>
      </div>

      {/* Ephemeral tabs for this account */}
      {accountEphTabs.length > 0 && (
        <div className="space-y-0.5">
          {accountEphTabs.map((tab) => {
            const tabActive = tab.id === activeEphemeralTabId;
            let displayTitle = tab.title;
            try { displayTitle = new URL(tab.url).hostname; } catch { /* keep original */ }

            return (
              <div key={tab.id} className="flex items-center">
                <button
                  onClick={() => onSelectEphemeralTab(tab.id)}
                  title={tab.url}
                  className={`titlebar-no-drag flex-1 flex items-center gap-2 rounded-md pl-6 pr-1 py-1 transition-colors relative ${
                    tabActive ? 'bg-gray-200/80 dark:bg-gray-600/50' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`}
                >
                  {tabActive && (
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
                    onClick={(e) => { e.stopPropagation(); onCloseEphemeralTab(tab.id); }}
                    className="p-0.5 text-gray-300 hover:text-gray-600 transition-colors shrink-0"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
