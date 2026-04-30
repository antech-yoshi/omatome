import React, { useEffect, useState } from 'react';

type DownloadState =
  | 'progressing'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'interrupted';

interface DownloadEntry {
  id: string;
  filename: string;
  totalBytes: number;
  receivedBytes: number;
  state: DownloadState;
  savePath: string;
}

interface StartedPayload {
  id: string;
  filename: string;
  totalBytes: number;
  savePath: string;
}

interface UpdatedPayload {
  id: string;
  state: 'progressing' | 'interrupted';
  paused: boolean;
  receivedBytes: number;
  totalBytes: number;
}

interface DonePayload {
  id: string;
  state: 'completed' | 'cancelled' | 'interrupted';
  savePath: string;
}

function formatBytes(n: number): string {
  if (!n || n < 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function DownloadFooter() {
  const [entries, setEntries] = useState<DownloadEntry[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    window.electronAPI.onShortcut('download:started', (payload: unknown) => {
      const p = payload as StartedPayload;
      setEntries((prev) => [
        ...prev,
        {
          id: p.id,
          filename: p.filename,
          totalBytes: p.totalBytes,
          receivedBytes: 0,
          state: 'progressing',
          savePath: p.savePath,
        },
      ]);
      setDismissed(false);
    });

    window.electronAPI.onShortcut('download:updated', (payload: unknown) => {
      const p = payload as UpdatedPayload;
      setEntries((prev) =>
        prev.map((e) =>
          e.id === p.id
            ? {
                ...e,
                receivedBytes: p.receivedBytes,
                totalBytes: p.totalBytes || e.totalBytes,
                state: p.paused ? 'paused' : p.state,
              }
            : e
        )
      );
    });

    window.electronAPI.onShortcut('download:done', (payload: unknown) => {
      const p = payload as DonePayload;
      setEntries((prev) =>
        prev.map((e) =>
          e.id === p.id ? { ...e, state: p.state, savePath: p.savePath || e.savePath } : e
        )
      );
    });

    return () => {
      window.electronAPI.removeShortcutListener('download:started');
      window.electronAPI.removeShortcutListener('download:updated');
      window.electronAPI.removeShortcutListener('download:done');
    };
  }, []);

  if (dismissed || entries.length === 0) return null;

  const handleClose = () => {
    setDismissed(true);
    setEntries([]);
  };

  const handleRemove = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-[0_-1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-gray-100 dark:border-gray-700/60">
        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Downloads
        </span>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="Close"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <ul className="max-h-40 overflow-y-auto">
        {entries.map((e) => {
          const pct =
            e.totalBytes > 0
              ? Math.min(100, Math.round((e.receivedBytes / e.totalBytes) * 100))
              : 0;
          const inProgress = e.state === 'progressing' || e.state === 'paused';
          const completed = e.state === 'completed';
          const failed = e.state === 'cancelled' || e.state === 'interrupted';

          return (
            <li
              key={e.id}
              className="flex items-center gap-3 px-4 py-2 border-b border-gray-50 dark:border-gray-700/40 last:border-b-0"
            >
              <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                {inProgress && (
                  <svg className="w-4 h-4 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                )}
                {completed && (
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {failed && (
                  <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86l-8.18 14.14A2 2 0 003.84 21h16.32a2 2 0 001.73-3l-8.18-14.14a2 2 0 00-3.42 0z" />
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-800 dark:text-gray-100 truncate" title={e.filename}>
                    {e.filename}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 tabular-nums">
                    {inProgress && e.totalBytes > 0 && `${pct}%`}
                    {inProgress && e.totalBytes <= 0 && formatBytes(e.receivedBytes)}
                    {completed && formatBytes(e.totalBytes || e.receivedBytes)}
                    {failed && (e.state === 'cancelled' ? 'Cancelled' : 'Failed')}
                  </span>
                </div>

                {inProgress && (
                  <div className="mt-1 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-[width] duration-150"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="shrink-0 flex items-center gap-1">
                {completed && e.savePath && (
                  <button
                    onClick={() => window.electronAPI.showItemInFolder(e.savePath)}
                    className="px-2 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors"
                    title="Show in folder"
                  >
                    Show
                  </button>
                )}
                <button
                  onClick={() => handleRemove(e.id)}
                  className="p-1 text-gray-300 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                  title="Dismiss"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
