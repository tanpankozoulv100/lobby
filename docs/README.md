# Lobby 仕様・説明ドキュメント

このフォルダは、実装・デザイン・運用の**説明・方針**を置く場所です。

| ドキュメント | 内容 |
|--------------|------|
| [SPEC_MAINTENANCE_POLICY.md](./SPEC_MAINTENANCE_POLICY.md) | **仕様書・指示書の更新ポリシー**（チャット指示の反映・コード変更時の同期） |
| [APP_INSTRUCTIONS.md](./APP_INSTRUCTIONS.md) | **ユーザーアプリの指示書**（画面・方針・バックログ） |
| [DESIGN_IMPLEMENTATION_POLICY.md](./DESIGN_IMPLEMENTATION_POLICY.md) | **Figma / PDF / スクショと実装の優先関係**（大前提・変更前の確認フロー） |
| [THEME_COLORS.md](./THEME_COLORS.md) | **テーマカラー**（Lobby レッド `#b3001b` / クリーム `#fdf8f0`） |
| [IDENTITY_DOCUMENT_RETENTION.md](./IDENTITY_DOCUMENT_RETENTION.md) | **本人確認書類の3年保管**（保管場所の選択肢・現状ギャップ） |

管理サイトの指示書: `lobby-admin/docs/ADMIN_INSTRUCTIONS.md`

## リポジトリ直下の正本（コードとセット）

| ファイル | 内容 |
|----------|------|
| `LOBBY_FINAL_SPEC.md` | 完成系の機能・データ仕様 |
| `UI_UX_SPEC.md` | UI 記録（PDF ベース。実装と食い違う箇所は **実装・本ポリシーが優先**） |
| `firestore.rules` / `lib/lobby-firestore-types.ts` | データ・権限の最終正本 |

**UI を Figma やスクショから直す前に**、必ず `docs/DESIGN_IMPLEMENTATION_POLICY.md` を読むこと。

## ターミナル・リポジトリのパス

この Cursor ワークスペースのルートは **`lobby-repo` そのもの**（例: `/Users/…/dev/lobby-repo`）です。

| 今いる場所 | やること |
|------------|----------|
| すでに `lobby-repo` 内（プロンプトに `lobby-repo` が出ている） | **`cd lobby-repo` は不要**。そのまま `npm run dev` や `npm run deploy:rules` |
| 親フォルダ `dev` など（`lobby-admin` と並んでいる） | `cd lobby-repo` または `cd lobby-admin` |
| 管理サイトだけ触る | `cd lobby-admin`（別リポジトリ: `…/dev/lobby-admin`） |

`cd lobby-repo` で「そんなファイルはない」と出るのは、**すでに `lobby-repo` の中にいる**ときがほとんどです。`pwd` で確認してください。
