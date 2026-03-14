import React from 'react';
import type { AppSettings, LinkOpenBehavior, Appearance } from '@shared/types';

interface SettingsProps {
  isOpen: boolean;
  settings: AppSettings;
  onClose: () => void;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
}

export default function Settings({
  isOpen,
  settings,
  onClose,
  onUpdateSettings,
}: SettingsProps) {
  if (!isOpen) return null;

  const appearanceOptions: { value: Appearance; label: string; description: string }[] = [
    { value: 'light', label: 'Light', description: 'Always use light appearance.' },
    { value: 'dark', label: 'Dark', description: 'Always use dark appearance.' },
    { value: 'system', label: 'System', description: 'Follow the system appearance setting.' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[480px] max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Appearance */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Appearance
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              Choose the visual theme for omatome.
            </p>

            <div className="flex gap-2">
              {appearanceOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onUpdateSettings({ appearance: opt.value })}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    settings.appearance === opt.value
                      ? 'border-indigo-300 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Link Behavior */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Link Handling
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              Choose how external links (URLs outside the current service) are opened.
            </p>

            <div className="space-y-2">
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  settings.linkOpenBehavior === 'external-browser'
                    ? 'border-indigo-300 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <input
                  type="radio"
                  name="linkBehavior"
                  value="external-browser"
                  checked={settings.linkOpenBehavior === 'external-browser'}
                  onChange={() => onUpdateSettings({ linkOpenBehavior: 'external-browser' })}
                  className="mt-0.5 accent-indigo-500"
                />
                <div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    Open in default browser
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    External links open in Safari, Chrome, etc. Service-internal links stay in omatome.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  settings.linkOpenBehavior === 'in-app'
                    ? 'border-indigo-300 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <input
                  type="radio"
                  name="linkBehavior"
                  value="in-app"
                  checked={settings.linkOpenBehavior === 'in-app'}
                  onChange={() => onUpdateSettings({ linkOpenBehavior: 'in-app' })}
                  className="mt-0.5 accent-indigo-500"
                />
                <div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    Open in omatome
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    All links navigate within the current webview. Use back/forward to return.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Download folder */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Downloads
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              Choose where files are saved when downloading from services.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 truncate">
                {settings.downloadPath || 'System default (asks each time)'}
              </div>
              <button
                onClick={async () => {
                  const folder = await window.electronAPI.selectFolder();
                  if (folder) {
                    onUpdateSettings({ downloadPath: folder });
                  }
                }}
                className="px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors shrink-0"
              >
                Choose
              </button>
              {settings.downloadPath && (
                <button
                  onClick={() => onUpdateSettings({ downloadPath: undefined })}
                  className="px-2 py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
                  title="Reset to default"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Keyboard shortcuts reference */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Keyboard Shortcuts
            </h3>
            <div className="space-y-1.5 text-sm">
              {[
                ['Switch to account 1-9', '⌘ 1-9'],
                ['Next account', '⌘ ]'],
                ['Previous account', '⌘ ['],
                ['Toggle sidebar', '⌘ ⇧ S'],
                ['Reload page', '⌘ R'],
                ['Reload all services', '⌘ ⇧ R'],
                ['Back', '⌘ ←'],
                ['Forward', '⌘ →'],
                ['Settings', '⌘ ,'],
              ].map(([action, shortcut]) => (
                <div key={action} className="flex items-center justify-between py-1">
                  <span className="text-gray-600 dark:text-gray-400">{action}</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded text-xs font-mono">
                    {shortcut}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* About */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              About
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              omatome (All-In-One) v1.0.0
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Multi-service workspace manager with isolated sessions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
