# Lobby 完成系仕様（固定版）

最終更新: 2026-05-12

このドキュメントは、スレッドをまたいでも参照できる「完成系の仕様メモ」です。  
企画メモとの差分が出た場合、実装の正本は `firestore.rules` と `lib/lobby-firestore-types.ts` を優先します。

## 1. プロダクト前提

- Lobby は「30日間の主人公体験」を目指すシーズン制コミュニティアプリ。
- 技術基盤は Next.js + Firebase（Auth / Firestore）。
- 運営データ（イベント、告知、各種管理データ）は Console 投入を基本にしつつ、必要箇所は運営UIで補助する。

## 2. 利用開始ゲート（必須）

- まずログイン/新規登録。
- 以下2条件がそろってダッシュボード入場:
  - 本人確認承認（`identityStatus == "approved"`）
  - シーズンチケット確認済み（`ticketRedeemedAt` が存在）
- ローカル開発のみ `NEXT_PUBLIC_LOBBY_DEV_BYPASS_ONBOARDING` でバイパス可能（本番禁止）。

## 3. イベント

- 参加者は A/B コホートで分岐。
- 1日ごとに朝/昼/夜（`morning|afternoon|evening`）の枠を提示。
- 枠は `events/{eventId}/slotChoices/{slotId}` で管理し、同一 `(dateKey, period, cohort)` は最大2件（`lineIndex 0/1`）。
- 参加は任意（不参加可）。

## 4. チャット

- 下部ナビの「チャット」タブは常時表示。
- 会場でQR交換してマッチした相手とのチャットを 24時間限定で解放。
- シーズン最終日に成立したマッチは 72時間解放（最終マッチング特例）。
- 24時間が過ぎた相手とのチャットは自動的に未解放扱い。
- 現在の土台実装では、マッチ履歴（`outboundLinks`）の `createdAt` を解放起点として扱う。

## 5. デートお誘い券

- 10マッチごとに1枚付与。
- 各券の有効期限は72時間。
- 送信先は「これまでマッチした相手」から1人選ぶ。
- 内容は一方通行（候補日時・場所・任意メッセージ）。承諾UIは作らない。

## 6. Firestore モデル（チャット/券の実装用）

- マッチ履歴
  - `users/{uid}/outboundLinks/{peerUid}`（既存）
  - `users/{uid}/linkedFrom/{peerUid}`（既存）
- デート券
  - `users/{uid}/dateInviteTickets/{ticketId}`
  - フィールド: `milestoneMatches`, `grantedAt`, `expiresAt`, `consumedAt`, `consumedByInviteId`
- お誘い送信ログ
  - `users/{uid}/dateInvites/{inviteId}`
  - フィールド: `toUid`, `location`, `proposedAt`, `message`, `ticketId`, `createdAt`

## 7. 安全系（今後）

- 通報関係者のグループ分離。
- 通報3回で強制退会の運用設計。
- ブロック/通報/モデレーションを段階的に実装。

