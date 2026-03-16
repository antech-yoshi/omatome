import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Group } from '@shared/types';

interface SortableGroupSectionProps {
  group: Group;
  collapsed: boolean;
  isAccountDragging: boolean;
  onEditGroup: (group: Group) => void;
  children: React.ReactNode;
  hasAccounts: boolean;
}

export default function SortableGroupSection({
  group,
  collapsed,
  isAccountDragging,
  onEditGroup,
  children,
  hasAccounts,
}: SortableGroupSectionProps) {
  const sortableId = `group:${group.id}`;

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId, disabled: isAccountDragging });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `group-zone:${group.id}`,
    disabled: !isAccountDragging,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : undefined,
  };

  const showDropHighlight = isOver && isAccountDragging;

  return (
    <div
      ref={setSortableRef}
      style={style}
      {...attributes}
      className="mt-1 first:mt-0"
    >
      {!collapsed ? (
        <div
          {...listeners}
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
          {...listeners}
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
      {/* Droppable zone for accounts - separate ref */}
      <div
        ref={setDroppableRef}
        className={`space-y-0.5 rounded-md transition-all ${
          showDropHighlight
            ? 'bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-300 min-h-[40px]'
            : !hasAccounts
              ? 'min-h-[24px]'
              : ''
        }`}
      >
        {children}
      </div>
    </div>
  );
}
