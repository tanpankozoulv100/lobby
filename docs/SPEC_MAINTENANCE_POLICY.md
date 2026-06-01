# 仕様書・指示書の更新ポリシー

最終更新: 2026-05-19

## 大前提（運営からの指示）

1. **このチャット（Cursor）でユーザーが指示した内容は、すべて指示書に反映する。**
2. **ユーザーアプリ用と管理サイト用の指示書は別ファイルで管理する。**
3. **コード・Firestore ルール・API・画面に変更が入ったら、同じ PR / 同じ作業単位で指示書も書き直す。**  
   「あとでドキュメント」は原則しない。

## 指示書の置き場所

| 対象 | 指示書（製品・画面・運用の意思決定） | 技術正本（データ・権限） |
|------|--------------------------------------|-------------------------|
| ユーザーアプリ | [`APP_INSTRUCTIONS.md`](./APP_INSTRUCTIONS.md) | `LOBBY_FINAL_SPEC.md`、`firestore.rules`、`lib/lobby-firestore-types.ts` |
| 管理サイト | `lobby-admin/docs/ADMIN_INSTRUCTIONS.md` | 同上 + `lobby-admin` の API 実装 |

補助:

| ファイル | 用途 |
|----------|------|
| `UI_UX_SPEC.md` | UI 記録（PDF ベース。実装と矛盾時は [`DESIGN_IMPLEMENTATION_POLICY.md`](./DESIGN_IMPLEMENTATION_POLICY.md) 優先） |
| `docs/DESIGN_IMPLEMENTATION_POLICY.md` | Figma / スクショ vs 実装の優先関係 |
| `docs/THEME_COLORS.md` | テーマカラー |
| `docs/SEASON_AND_TICKET_SPEC.md` | シーズン・シリアル・No. 採番・参加人数の正本 |

## 更新タイミング（チェックリスト）

作業完了前に、次を確認する。

- [ ] ユーザー指示が `APP_INSTRUCTIONS.md` または `ADMIN_INSTRUCTIONS.md` に追記・修正されたか
- [ ] データモデル・権限・API を変えたら `LOBBY_FINAL_SPEC.md` / `lobby-firestore-types.ts` / `firestore.rules` と整合しているか
- [ ] 管理サイトだけの画面・API を変えたら `ADMIN_INSTRUCTIONS.md` の「実装状況」表を更新したか
- [ ] ユーザーアプリだけの画面を変えたら `APP_INSTRUCTIONS.md` の「実装状況」を更新したか
- [ ] 自動化（Cron・スプレッドシート連携）の変更は管理サイト指示書の「運用・自動化」に反映したか

## 書き方のルール

- **決まったこと**は「方針」「必須」「しないこと」を明示する。
- **未実装・検討中**は「バックログ」「要確認」とラベルを付け、日付を入れる。
- **実装済み**は「実装状況」表で画面パス・API・備考を1行で追えるようにする。
- 仕様と実装が食い違ったら、**意図的な変更なら指示書を先に直す**。バグならコードを直し、指示書も合わせる。

## AI / Cursor 向け

- ユーザーが機能・運用・UI を指示したら、**コードを触る前または同時に**該当指示書を更新する。
- マルチルートワークスペース（`lobby-repo` + `lobby-admin`）では、両方の指示書を必要に応じて更新する。
- `AGENTS.md` は本ポリシーへのリンクを含む（リポジトリ直下）。
