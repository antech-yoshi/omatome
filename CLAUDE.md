# CLAUDE.md

## Project: AIO (omatome)

複数Webサービスを独立セッションで同時利用できるElectronデスクトップアプリ。

## Tech Stack

- Electron + TypeScript + React + Tailwind CSS v4
- ビルド: electron-vite / electron-builder
- パッケージ: npm (commonjs)
- パスエイリアス: `@shared`, `@main`, `@renderer`

## Commands

- `npm run dev` — 開発サーバー起動
- `npm run dev:clean` — データクリア後に起動
- `npm run build` — ビルド
- `npm run package:mac` / `package:win` — パッケージング

## Architecture

- `src/main/` — Electronメインプロセス (ウィンドウ管理, IPC, セッション管理, ショートカット)
- `src/main/preload.ts` — contextBridge経由のAPI公開
- `src/renderer/` — React UI (Sidebar, WebViewContainer, Settings, モーダル類)
- `src/shared/` — 型定義 (`types.ts`) と定数 (`constants.ts`)
- `resources/` — アイコン等の静的リソース

## Key Design Decisions

- セッション分離: `session.fromPartition('persist:<account-id>')` で各アカウントのCookie/Storage完全分離
- WebView: `<webview>` タグ採用 (BrowserViewは非推奨のため)
- セキュリティ: contextIsolation: true, nodeIntegration: false, sandbox: true
- UIテーマ: ホワイトモードのみ (v1)

## Development Status

Phase 1 (MVP) の実装中。Step 1-1〜1-7 の範囲。
詳細は `docs/requirements.md` と `docs/development-plan.md` を参照。
