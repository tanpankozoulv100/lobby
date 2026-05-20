<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 仕様書・指示書（必須）

- **更新ポリシー:** `docs/SPEC_MAINTENANCE_POLICY.md` — ユーザーの指示とコード変更は、必ず指示書に反映する。
- **ユーザーアプリ指示書:** `docs/APP_INSTRUCTIONS.md`
- **管理サイト指示書:** `lobby-admin/docs/ADMIN_INSTRUCTIONS.md`（別リポジトリ）
- **技術正本:** `LOBBY_FINAL_SPEC.md`、`firestore.rules`、`lib/lobby-firestore-types.ts`

## Lobby UI（Figma / スクショ）

Figma・PDF・スクショから UI を変える前に **`docs/DESIGN_IMPLEMENTATION_POLICY.md`** を読むこと。既存実装を優先し、まとめて変更する前に「変えない / 変える / 要確認」一覧でユーザー確認を取る。
