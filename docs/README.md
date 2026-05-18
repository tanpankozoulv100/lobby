# Lobby 仕様・説明ドキュメント

このフォルダは、実装・デザイン・運用の**説明・方針**を置く場所です。

| ドキュメント | 内容 |
|--------------|------|
| [DESIGN_IMPLEMENTATION_POLICY.md](./DESIGN_IMPLEMENTATION_POLICY.md) | **Figma / PDF / スクショと実装の優先関係**（大前提・変更前の確認フロー） |
| [THEME_COLORS.md](./THEME_COLORS.md) | **テーマカラー**（Lobby レッド `#b3001b` / クリーム `#fdf8f0`） |

## リポジトリ直下の正本（コードとセット）

| ファイル | 内容 |
|----------|------|
| `LOBBY_FINAL_SPEC.md` | 完成系の機能・データ仕様 |
| `UI_UX_SPEC.md` | UI 記録（PDF ベース。実装と食い違う箇所は **実装・本ポリシーが優先**） |
| `firestore.rules` / `lib/lobby-firestore-types.ts` | データ・権限の最終正本 |

**UI を Figma やスクショから直す前に**、必ず `docs/DESIGN_IMPLEMENTATION_POLICY.md` を読むこと。
