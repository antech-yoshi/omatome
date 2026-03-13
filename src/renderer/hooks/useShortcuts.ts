import { useEffect, useRef } from 'react';

interface ShortcutHandlers {
  onToggleSidebar: () => void;
  onReload: () => void;
  onBack: () => void;
  onForward: () => void;
  onNextAccount: () => void;
  onPrevAccount: () => void;
  onSwitchAccount: (index: number) => void;
  onSettings: () => void;
}

export function useShortcuts(handlers: ShortcutHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const api = window.electronAPI;

    api.onShortcut('shortcut:toggle-sidebar', () => handlersRef.current.onToggleSidebar());
    api.onShortcut('shortcut:reload', () => handlersRef.current.onReload());
    api.onShortcut('shortcut:back', () => handlersRef.current.onBack());
    api.onShortcut('shortcut:forward', () => handlersRef.current.onForward());
    api.onShortcut('shortcut:next-account', () => handlersRef.current.onNextAccount());
    api.onShortcut('shortcut:prev-account', () => handlersRef.current.onPrevAccount());
    api.onShortcut('shortcut:switch-account', (index: unknown) => {
      if (typeof index === 'number') {
        handlersRef.current.onSwitchAccount(index);
      }
    });
    api.onShortcut('shortcut:settings', () => handlersRef.current.onSettings());

    return () => {
      api.removeShortcutListener('shortcut:toggle-sidebar');
      api.removeShortcutListener('shortcut:reload');
      api.removeShortcutListener('shortcut:back');
      api.removeShortcutListener('shortcut:forward');
      api.removeShortcutListener('shortcut:next-account');
      api.removeShortcutListener('shortcut:prev-account');
      api.removeShortcutListener('shortcut:switch-account');
      api.removeShortcutListener('shortcut:settings');
    };
  }, []);
}
