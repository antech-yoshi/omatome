# AIO - 開発計画書

> 要件定義書: [requirements.md](./requirements.md)

---

## Phase 1 - MVP (Minimum Viable Product)

アプリの核となるセッション分離 + マルチアカウント切り替えを最短で動作させる。

### Step 1-1: プロジェクト初期構築

**目的**: 開発環境の整備とアプリの骨格を作る

- [ ] Electronプロジェクトの初期化 (TypeScript)
- [ ] React + Tailwind CSS のレンダラー環境構築
- [ ] ディレクトリ構成の確立
- [ ] ESLint / Prettier 設定
- [ ] electron-builder の基本設定 (macOS / Windows)
- [ ] 開発用のホットリロード環境構築 (electron-vite or similar)

**ディレクトリ構成案**:
```
aio/
├── src/
│   ├── main/                  # Electronメインプロセス
│   │   ├── index.ts           # エントリーポイント
│   │   ├── window.ts          # ウィンドウ管理
│   │   ├── session-manager.ts # セッション分離管理
│   │   ├── ipc-handlers.ts    # IPCハンドラ
│   │   └── preload.ts         # preloadスクリプト
│   ├── renderer/              # Reactレンダラー
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Sidebar/
│   │   │   ├── WebViewContainer/
│   │   │   └── Settings/
│   │   ├── stores/            # 状態管理
│   │   ├── hooks/
│   │   ├── types/
│   │   └── index.html
│   └── shared/                # メイン・レンダラー共有型定義
│       ├── types.ts
│       └── constants.ts
├── resources/
│   └── icons/                 # サービスアイコン (SVG)
├── docs/
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── electron-builder.yml
└── README.md
```

**成果物**: `npm run dev` でElectronの空ウィンドウが起動する状態

---

### Step 1-2: プリセットサービス定義とデータモデル

**目的**: サービスとアカウントのデータ構造を定義する

- [ ] サービス定義の型とプリセットデータの作成
- [ ] アカウント(インスタンス)の型定義
- [ ] electron-store によるアカウント設定の永続化
- [ ] プリセットサービス用アイコンの収集・配置 (SVG)

**データモデル**:
```typescript
// サービス定義
interface ServiceDefinition {
  id: string;
  name: string;
  url: string;
  icon: string;          // SVGパスまたはアイコン名
  isPreset: boolean;
}

// アカウント(インスタンス)
interface Account {
  id: string;            // UUID
  serviceId: string;     // ServiceDefinition.id への参照
  label: string;         // ユーザー設定ラベル
  color: string;         // カラーラベル (hex)
  order: number;         // サイドバー表示順
  partitionKey: string;  // persist:<account-id>
}
```

**成果物**: プリセットサービス8種のデータとアイコンが揃い、アカウント追加・保存・読み込みができる

---

### Step 1-3: サイドバーUI

**目的**: サービス/アカウントの一覧UIを構築する

- [ ] サイドバーコンポーネント (アイコンバー形式)
- [ ] サービスアイコン + カラーインジケーターの表示
- [ ] ツールチップによるアカウントラベル表示
- [ ] アクティブ状態のハイライト (淡いグレー背景)
- [ ] サイドバー下部に「+」ボタン (サービス追加用)
- [ ] サービス追加モーダル (プリセットから選択 → ラベル・カラー設定)

**デザイン仕様**:
- 幅: 56px (アイコンのみ) / 200px (展開時)
- 背景: `#FAFAFA` (淡いグレー)
- ボーダー: `#E5E7EB` (右側1px)
- アイコンサイズ: 32px x 32px
- ホバー: `#F3F4F6`
- アクティブ: `#E5E7EB` + 左側に3pxのアクセントカラーバー

**成果物**: サイドバーにアカウント一覧が表示され、クリックで選択状態が切り替わる

---

### Step 1-4: WebView管理とセッション分離

**目的**: アプリの核心機能 — セッション分離されたWebViewの生成と切り替え

- [ ] `session.fromPartition('persist:<account-id>')` によるセッション生成
- [ ] BrowserView (または `<webview>` タグ) でアカウントごとのWebView生成
- [ ] サイドバー選択に連動したWebView表示切り替え
- [ ] 非アクティブなWebViewはhidden状態で維持 (バックグラウンド保持)
- [ ] UserAgent設定 (各サービスのWebアプリが正常動作するよう調整)
- [ ] 外部リンクのデフォルトブラウザ開放 (`shell.openExternal`)
- [ ] 新規ウィンドウ (window.open) のハンドリング

**成果物**: サイドバーでアカウントを切り替えると、独立セッションのWebViewが即座に表示される。同一サービスの複数アカウントに同時ログイン可能。

---

### Step 1-5: セッション永続化

**目的**: アプリ再起動後も再ログイン不要にする

- [ ] `persist:` プレフィックス付きパーティションによるCookie/LocalStorage自動永続化の確認
- [ ] アプリ起動時に保存済みアカウントのWebViewを復元
- [ ] 前回アクティブだったアカウントを記憶し、起動時に自動選択
- [ ] アカウント単位のセッションクリア機能 (右クリックメニュー)

**成果物**: アプリを終了→再起動しても、各アカウントのログイン状態が維持されている

---

### Step 1-6: キーボードショートカット

**目的**: キーボードによる高速操作

- [ ] `CmdOrCtrl + 1〜9`: サイドバーのN番目のアカウントに切り替え
- [ ] `CmdOrCtrl + ]` / `[`: 次/前のアカウントに切り替え
- [ ] `CmdOrCtrl + Shift + S`: サイドバーのトグル
- [ ] `CmdOrCtrl + R`: ページリロード
- [ ] `CmdOrCtrl + ←` / `→`: 戻る / 進む
- [ ] `CmdOrCtrl + ,`: 設定を開く
- [ ] `CmdOrCtrl + F`: ページ内検索
- [ ] Electronの `globalShortcut` または `Menu` acceleratorで実装

**成果物**: 全ショートカットが動作し、マウスなしでアカウント切り替え・操作が可能

---

### Step 1-7: 基本設定画面

**目的**: 最低限の設定UIを提供する

- [ ] 設定画面のレイアウト (モーダルまたは専用ビュー)
- [ ] アカウント管理 (ラベル編集、カラー変更、削除)
- [ ] アカウントのセッションクリア
- [ ] 全データの一括削除

**成果物**: 設定画面からアカウントの管理とセッション操作ができる

---

## Phase 2 - ユーザビリティ向上

### Step 2-1: ワークスペース機能

- [ ] ワークスペースのデータモデル定義
- [ ] ワークスペース作成・編集・削除UI
- [ ] アカウントをワークスペースにグルーピング
- [ ] ワークスペース単位の一括切り替え

### Step 2-2: カスタムサービス追加

- [ ] カスタムURL入力によるサービス追加
- [ ] サービス名・アイコン(任意)の設定
- [ ] カスタムサービスの編集・削除

### Step 2-3: ネイティブ通知連携

- [ ] Web Notification API のインターセプトとOS通知への連携
- [ ] 通知クリック時の該当アカウント自動切り替え
- [ ] アカウント単位の通知ON/OFF設定

### Step 2-4: 未読バッジ

- [ ] WebViewのタイトル変化監視 (タイトルに未読数が含まれるサービス対応)
- [ ] Favicon変化の検知 (Slackなど)
- [ ] サイドバーアイコンへのバッジ表示

### Step 2-5: ドラッグ&ドロップ並び替え

- [ ] サイドバー内アカウントのD&D並び替え
- [ ] 並び順の永続化

---

## Phase 3 - 安定性・配布

### Step 3-1: メモリ最適化

- [ ] 非アクティブWebViewのサスペンド (10分以上未使用時)
- [ ] サスペンドからの復帰時の状態復元
- [ ] メモリ使用量のモニタリング

### Step 3-2: クラッシュ復旧

- [ ] WebViewクラッシュの検知と自動リロード
- [ ] アプリ異常終了時の状態復元
- [ ] エラーログの収集

### Step 3-3: アクセシビリティ

- [ ] キーボードナビゲーションの完全対応
- [ ] ARIA属性の付与
- [ ] スクリーンリーダーテスト

### Step 3-4: ビルド・配布

- [ ] electron-builder でのパッケージング最終調整
- [ ] macOS: DMGインストーラー、コード署名
- [ ] Windows: NSISインストーラー
- [ ] 自動アップデート機能 (electron-updater)
- [ ] GitHub Releases による配布

---

## 実装優先度マトリクス

| 優先度 | Step | 内容 | 依存関係 |
|--------|------|------|----------|
| 1 | 1-1 | プロジェクト初期構築 | なし |
| 2 | 1-2 | データモデル・プリセット定義 | 1-1 |
| 3 | 1-3 | サイドバーUI | 1-1, 1-2 |
| 4 | 1-4 | WebView管理・セッション分離 | 1-1, 1-2 |
| 5 | 1-5 | セッション永続化 | 1-4 |
| 6 | 1-6 | キーボードショートカット | 1-3, 1-4 |
| 7 | 1-7 | 基本設定画面 | 1-3, 1-4 |
| 8 | 2-1〜2-5 | Phase 2各機能 | Phase 1完了 |
| 9 | 3-1〜3-4 | Phase 3各機能 | Phase 2完了 |

---

## 技術的な注意事項

### Electron BrowserView vs webview タグ
- **BrowserView** は Electron 公式で非推奨化が進んでいる
- **`<webview>` タグ** を採用し、レンダラープロセス内で管理する方針とする
- webviewは `partition` 属性でセッション分離が可能

### セキュリティ設定
```typescript
// BrowserWindow生成時
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  preload: path.join(__dirname, 'preload.js'),
  sandbox: true,
}
```

### サービスごとのUserAgent対応
一部サービス(Slack, Teamsなど)はUserAgentによって挙動が変わるため、Chrome相当のUserAgentを設定する必要がある。
