# Lobby ユーザーアプリ — 指示書

最終更新: 2026-05-19

**技術正本:** `LOBBY_FINAL_SPEC.md`、`firestore.rules`、`lib/lobby-firestore-types.ts`  
**更新ポリシー:** [`SPEC_MAINTENANCE_POLICY.md`](./SPEC_MAINTENANCE_POLICY.md)

管理サイトの指示書は別ファイル: `lobby-admin/docs/ADMIN_INSTRUCTIONS.md`

---

## 1. プロダクト方針（固定）

- 30日間のシーズン制コミュニティ（オフライン・マッチング中心）。
- 技術: Next.js + Firebase（Auth / Firestore / Storage）。
- 運営コンソールは **別サイト**（`lobby-admin`）。本体に `/admin` は置かない。
- Figma / PDF / スクショと実装が食い違うときは [`DESIGN_IMPLEMENTATION_POLICY.md`](./DESIGN_IMPLEMENTATION_POLICY.md) に従い、**既存実装を優先**（変更前にユーザー確認）。

---

## 2. 利用開始ゲート

### 新規登録で収集する情報

| 項目 | 保存先 | 変更可否 |
|------|--------|----------|
| メール・パスワード | Auth | 別途 |
| 本名 | `legalName` | **不可** |
| ユーザー名 | `displayName` | 可（マイページ） |
| 性別 | `gender` | **不可** |
| 生年月日 | `birthDate` | **不可** |
| 居住地 | `prefecture` | 可（マイページ） |

### オンボーディング

| 条件 | 内容 |
|------|------|
| 必須 | 本人確認 `approved`（顔写真付き書類）、シーズンチケット `ticketRedeemedAt` |
| 保管 | 方針 **A**: Storage + `identitySubmittedAt` を3年（`docs/IDENTITY_DOCUMENT_RETENTION.md`） |
| チケット | `ticketCodes.intendedGender` とユーザー `gender` が一致すること |
| 運営 | `admins/{uid}` で上記スキップ。No.000 固定 |
| 停止 | `accountStatus: suspended` で停止画面 |

---

## 3. 画面・機能（指示・実装状況）

| 領域 | 指示・仕様 | 実装状況 | 主なコード |
|------|------------|----------|------------|
| ホーム | QR 表示・スキャン・コード入力、お知らせ、シーズン帯 | 実装済 | `dashboard-home-screen.tsx` 等 |
| 履歴 | マッチ一覧・通報・ブロック（コード入力はホーム） | 実装済 | `dashboard-connections-section.tsx` |
| チャット | 24h/72h、再マッチ、過去閲覧、運営は期限なし | 実装済 | `dashboard-chat-section.tsx`、`LOBBY_FINAL_SPEC` §4 |
| イベント | カレンダー・A/B 枠・任意参加 | 実装済 | `dashboard-events-section.tsx`、`use-event-calendar-slots.ts` |
| マイページ | No.xxx 表示（UID は出さない方針） | 実装済 | `dashboard-mypage-tab.tsx` |
| 安全 | 通報・ブロック・Functions 停止・コホート反転 | 実装済 | `firestore-safety.ts`、`functions/` |
| 運営仮 UI | `/staff/events` | **廃止予定** → 管理サイトへ | `app/staff/events` |

---

## 4. イベント・コホート（アプリ側の見え方）

- 参加者は **週ごとの A/B**（`users/{uid}/cohortWeeks/{weekKey}`）。
- 表示範囲は `eventDisplayWindow/current`（`visibleFromDateKey`〜`visibleToDateKey`）。
- UI 文言: 「週ごとに自動更新」（`event-slot-section.tsx`）。
- 枠データ: `events/{id}/slotChoices`（`dateKey`, `period`, `cohort`, `lineIndex`）。

**運用の自動化（アプリ外）:** 毎週の A/B 再編成と表示週更新は管理側 API で実行（詳細は管理サイト指示書）。ユーザーアプリは結果を読むだけ。

---

## 5. マッチングデータ（アプリ）

- 連携: `outboundLinks` / `linkedFrom`（`lastMatchedAt` で再マッチ）。
- チャット: `chatThreads/{low_high}/messages`。
- **日別・組数の運営集計 UI はアプリにはない**（管理サイトバックログ）。

---

## 6. バックログ（ユーザーアプリ）

| 項目 | メモ |
|------|------|
| `/staff/events` 削除 | 管理サイト運用が安定したらルート・リンクを削除 |
| プッシュ通知 等 | `AGENT_HANDOVER.md` 参照 |

---

## 7. 変更履歴（指示の反映ログ）

| 日付 | 内容 |
|------|------|
| 2026-05-19 | 指示書運用開始。管理サイト分離・仕様書更新ポリシーを `SPEC_MAINTENANCE_POLICY.md` に定義 |
| 2026-05-19 | 新規登録: 本名・性別・生年月日・都道府県・表示名。チケット `intendedGender` 照合。本名・性別・生年月日は変更不可 |
| 2026-05-19 | 本人確認: 顔写真付き書類、3年保管設計メモ `IDENTITY_DOCUMENT_RETENTION.md` |
