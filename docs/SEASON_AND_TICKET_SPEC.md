# シーズン・シリアル（チケット）仕様

最終更新: 2026-06-01

**正本:** 本ファイル（製品・運用の説明） + `lib/lobby-firestore-types.ts` + `firestore.rules`  
**管理画面:** `lobby-admin` → `/dashboard/seasons`  
**関連コード:** `lib/firestore-tickets.ts`、`lib/ticket-serial.ts`、`lib/firestore-season-participant-no.ts`、`lib/use-user-season.ts`

---

## 1. 背景・要件

- **同じ場所で年に2回以上**開催しうる（例: 名古屋 春 / 秋）
- **同時期に2箇所以上**で開催しうる（例: 名古屋 + 東京）
- ユーザーは **本人確認のあと** にシリアル番号を入力し、**そのシーズン専用の表示**（タイトル・期間・参加人数・No.）に切り替わる
- **参加人数**は運営が手入力しない。シリアル引き換え数（= そのシーズンの No. 付与数）を自動表示
- **ホームの No.** もシリアル入力順でシーズンごとに採番（ダッシュボード初回開放順ではない）

---

## 2. データモデル（Firestore）

### 2.1 `seasons/{seasonId}`

| フィールド | 型 | 説明 |
|------------|-----|------|
| `name` | string | 管理用の短い名前 |
| `locationLabel` | string | 表示用開催地（例: 名古屋） |
| `locationSlug` | string | シリアル接頭辞用（例: `nagoya`、英小文字・数字） |
| `year` | number | 開催年（例: 2026） |
| `round` | number | 開催回数（1=一回目、2=二回目） |
| `headerTitle` | string | ホーム上部タイトル |
| `cardTitle` | string | カード・マッチング履歴のタイトル |
| `dateRangeLabel` | string | 表示用期間（例: `2026.04.17-05.18`） |
| `startAt` / `endAt` | timestamp | シーズン期間（カウントダウン・最終日72h判定） |
| `cohortSeasonKey` | string | A/B フォールバック用（**自動**: `{場所スラッグ}-{年}-{回数2桁}` 例: `nagoya-2026-01`） |
| `redeemedCount` | number | **自動** — シリアル引き換え済み人数 |
| `issuedTicketCount` | number | **自動** — 管理サイトで発行したシリアル数 |
| `status` | `draft` \| `published` \| `archived` | 公開状態 |
| `isLegacyDefault` | boolean? | 旧チケット（`seasonId` なし）向けフォールバック（1件のみ推奨） |
| `sortOrder` | number? | 管理一覧の並び |

**廃止:** `participatingCount`（手動参加人数）は使わない。既存ドキュメントに残っていても表示は `redeemedCount` を正とする。

### 2.2 `ticketCodes/{code}`

ドキュメント ID = **正規化済みシリアル**（英数字のみ・大文字。`lib/ticket-code.ts` の `normalizeSeasonTicketCode`）。

| フィールド | 型 | 説明 |
|------------|-----|------|
| `seasonId` | string | 紐づく `seasons/{id}`（新規発行では必須） |
| `intendedGender` | `male` \| `female` | 性別照合（登録性別と不一致なら引き換え拒否） |
| `usedBy` | string \| null | 引き換えたユーザーの uid |
| `usedAt` | timestamp? | 引き換え日時 |
| `createdAt` | timestamp? | 管理サイト発行日時 |

### 2.3 `users/{uid}`（シーズン関連）

| フィールド | 説明 |
|------------|------|
| `currentSeasonId` | 参加中シーズン（引き換え時に設定） |
| `seasonTicketCode` | 使用したシリアル（正規化済み） |
| `ticketRedeemedAt` | 引き換え日時 |
| `participantNo` | **そのシーズン内**の参加番号（引き換え順。001〜） |
| `lobbyOpenedAt` | 引き換え時にも設定（ホーム表示の基準） |

### 2.4 `system/seasonParticipantCounters/{seasonId}`

| フィールド | 説明 |
|------------|------|
| `nextNumber` | 次に付与する No.（引き換えトランザクションで +1） |

運営（`admins`）は従来どおり **No.000**（`claimParticipantNumberOnLobbyOpen`、ダッシュボード初回）。

---

## 3. シリアル番号の形式（運営が外部で発行する際の目安）

運営が Shopify 等でコードを作るときの**推奨パターン**。管理サイトはこの形式を自動生成しない。

```
{locationSlug}{year}{round(2桁)}{gender}{任意の末尾}
```

| 部分 | 例 | 説明 |
|------|-----|------|
| locationSlug | `nagoya` | 場所（英小文字・数字）— シーズンの `locationSlug` と揃える |
| year | `2026` | 4桁の年 |
| round | `01` | 回数（01〜99） |
| gender | `x` / `y` | **x = 女性**, **y = 男性**（照合は `intendedGender` が正） |
| 末尾 | `abcd` | 任意（重複回避用） |

**例:** 2026年名古屋一回目・女性 → `nagoya202601xabcd`（Firestore では英数字のみ・大文字化して保存）

アプリは `seasonId` + `intendedGender` + 引き換え順で振り分け。末尾文字列のパースは必須ではない。

---

## 4. ユーザーアプリのフロー

```
新規登録 → 本人確認（approved） → シリアル入力（オンボーディング）
  → Firestore トランザクション:
       - ticketCodes.usedBy = uid
       - seasons.redeemedCount += 1
       - system/seasonParticipantCounters/{seasonId} から No. 採番
       - users: currentSeasonId, participantNo, ticketRedeemedAt, lobbyOpenedAt
  → ダッシュボード
```

### 4.1 表示が切り替わる箇所

`useUserSeason(uid)` → `SeasonDisplay` を参照:

- ホーム: シーズン名・期間・カウントダウン赤帯・QRカードのタイトル
- マッチング履歴: シーズン名・**「このシーズンには N 人が参加しています」**（N = `redeemedCount`）
- イベント: カウントダウン
- マイページ: お問い合わせ文のシーズン名
- A/B コホート: `cohortSeasonKey` をシーズンから取得

フォールバック: `currentSeasonId` がなくチケット済みの場合は `isLegacyDefault` の published シーズン。それもなければ `lib/season-config.ts` の固定値。

### 4.2 No. の表示

- `users.participantNo` を `formatParticipantNoDisplay` で表示（001〜999は3桁、1000〜は4桁）
- 一般ユーザー: **シリアル引き換え時のみ**採番。ホーム初回開放では採番しない
- 運営: ダッシュボード初回で **000**

### 4.3 チャット・再マッチ

シーズンの `endAt` を正として最終日 72h / 通常 24h（`lib/match-chat-window.ts`、`lib/firestore-chat-date.ts`）。

---

## 5. 管理サイトの運用

### 5.1 シーズン CRUD（`/dashboard/seasons`）

1フォームで以下を入力:

| 項目 | 説明 |
|------|------|
| 都市名 | 表示用（例: 名古屋）。内部 ID は自動生成 |
| 年数 | 開催年 |
| 何回目 | 1=一回目 |
| 開催時期 | 開始日・終了日（日付選択）→ **期間表示**は自動（`2026.06.01 〜 2026.06.30`） |
| 表示名 | アプリのホーム・履歴タイトル |
| シリアル番号 | 女性用・男性用をそれぞれ手入力（1行1件） |

2. ステータスを **公開中** にして保存
3. 編集時はシリアルを追記登録可能（既存分は上書きしない）

### 5.2 シリアルの手入力登録（自動生成なし）

Shopify 等で運営が用意したコードを、**シーズン作成フォーム内**の女性用・男性用テキストエリアから登録する。

- 画面: `/dashboard/seasons` — シリアル番号（女性）/（男性）欄
- 1行1件（またはカンマ・改行区切り）
- API: `POST /api/admin/seasons/{id}/tickets`  
  body: `{ "gender": "female" | "male", "codes": ["…"] }` または `codesText`
- **自動ランダム発行はしない**

### 5.3 件数の再集計（メンテ用）

- API: `POST /api/admin/seasons/{id}/tickets`  
  body: `{ "action": "sync_counts" }`
- `ticketCodes` を数え `redeemedCount`（引き換え済）と `issuedTicketCount`（登録数）を上書き

### 5.4 旧チケット

- Firestore に `seasonId` のない `ticketCodes` がある場合、**フォールバック既定**（`isLegacyDefault: true`）の published シーズンに紐づけて採番・表示する
- 新規発行分は必ず `seasonId` 付きで運用すること

---

## 6. セキュリティルール（要デプロイ）

デプロイ: `lobby-repo` で `npm run deploy:rules`

| パス | 参加者 |
|------|--------|
| `seasons/{id}` | read: `published` または運営 / update: `redeemedCount` のみ +1 |
| `ticketCodes/{code}` | update: `usedBy`（+ `usedAt`）を本人 uid に |
| `system/seasonParticipantCounters/{seasonId}` | create/update: 採番カウンタ（+1 のみ） |
| `users/{uid}` | update: 引き換え時 `participantNo` + `currentSeasonId` 等 |

書き込みは Admin SDK（管理サイト API）のみ: シーズン本体の作成・シリアル発行。

---

## 7. 同時開催・年複数回の整理

| ケース | 運営の設定 | ユーザーの体験 |
|--------|------------|----------------|
| 名古屋 2026 第1回 | シーズン A + シリアル `nagoya202601x…` / `…y…` | 引き換えたシリアルのシーズン A の表示・No. |
| 名古屋 2026 第2回 | シーズン B（別 `cohortSeasonKey`）+ 新シリアル `nagoya202602x…` | 別シーズンとして独立した No. 列 |
| 名古屋 + 東京 同時期 | シーズン C / D、それぞれ別スラッグ | チケットの `seasonId` で決まる |

**1ユーザー1シーズンチケット**（`ticketRedeemedAt` は1回のみ）。別シーズン参加は別アカウントまたは将来の仕様変更が必要。

---

## 8. 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-06-01 | 初版: Firestore `seasons`、管理サイト CRUD、シリアル形式・自動採番・自動参加人数 |
| 2026-06-01 | シリアルは運営手入力登録のみ（自動一括発行を廃止）。命名規則は目安として記載 |
| 2026-06-06 | 管理 UI: シリアルは1件ずつ手入力を主操作に（一括貼り付けは補助） |
| 2026-06-06 | シーズン入力を1フォーム化（都市名・年・回数・日付期間・表示名・シリアル男/女）。`dateRangeLabel` は日付から自動 |
