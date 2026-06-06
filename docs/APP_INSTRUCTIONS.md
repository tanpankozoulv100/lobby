# Lobby ユーザーアプリ — 指示書

最終更新: 2026-05-27

**技術正本:** `LOBBY_FINAL_SPEC.md`、`firestore.rules`、`lib/lobby-firestore-types.ts`  
**シーズン・シリアル・No. 採番:** [`SEASON_AND_TICKET_SPEC.md`](./SEASON_AND_TICKET_SPEC.md)（必読）  
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
| ユーザー名 | `displayName` | 可（マイページ → **プロフィール編集**） |
| 性別 | `gender` | **不可** |
| 生年月日 | `birthDate` | **不可** |
| 居住地 | `prefecture` | 可（マイページ → **プロフィール編集**） |

### オンボーディング

| 条件 | 内容 |
|------|------|
| 必須 | 本人確認 `approved`（顔写真付き書類）、シーズンチケット `ticketRedeemedAt` |
| 保管 | 方針 **A**: Storage + `identitySubmittedAt` を3年（`docs/IDENTITY_DOCUMENT_RETENTION.md`） |
| チケット | 本人確認後に **シリアル** 入力。形式・採番・参加人数は [`SEASON_AND_TICKET_SPEC.md`](./SEASON_AND_TICKET_SPEC.md) |
| 運営 | `admins/{uid}` で上記スキップ。No.000 固定（ダッシュボード初回） |
| 停止 | `accountStatus: suspended` で停止画面 |

---

## 3. 画面・機能（指示・実装状況）

| 領域 | 指示・仕様 | 実装状況 | 主なコード |
|------|------------|----------|------------|
| ホーム | QR・スキャン・コード入力、お知らせ、シーズン帯。**No. はシリアル引き換え順**（シーズンごと） | 実装済 | `dashboard-home-screen.tsx`、`use-user-season.ts` |
| 履歴 | 3列グリッド・**シーズン名・参加人数（自動）**・相手詳細・通報 | 実装済 | `dashboard-connections-section.tsx` |
| チャット | 24h/72h、**再マッチは前回から24h/72h経過後**、過去閲覧、DM通知 per peer、運営は期限なし。アイコンはプロフィール写真。**既読は相手の最終既読時刻ベース**（`chatThreads.lastReadLow/High`） | 実装済 | `dashboard-chat-section.tsx`、`profile-avatar-circle.tsx` |
| イベント | カレンダー・朝昼夕タブ・色丸（参加登録なし・一覧のみ） | 実装済 | `dashboard-events-section.tsx`、`event-period-slot-list.tsx` |
| マイページ | No.xxx、**鉛筆→プロフィール編集**、**各種設定→規約リンク一覧** | 実装済 | `dashboard-mypage-tab.tsx`、`profile-edit-sheet.tsx`、`settings-links-sheet.tsx` |
| 安全 | **通報のみ**（ブロックなし）・Functions 停止・コホート反転 | 実装済 | `reportPeer`、`functions/` |

**通報の趣旨（メモ）:** 他アプリのブロック（合わない人を切る）とは別。**迷惑行為・嫌がらせ・不適切な利用**など運営対応が必要なとき用。単に相性が合わないだけの用途ではない。
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

- 連携: `outboundLinks` / `linkedFrom`（`encounterCount`・`lastMatchedAt`）。
- **初回マッチ:** ホームで相手 QR スキャン or 6文字コード入力 → 自分の `outboundLinks` + 相手の `linkedFrom` を作成。
- **再マッチ:** 相手のコードを**再度**スキャン／入力（自分の QR 表示だけでは不可）。`lastMatchedAt` 更新でチャット送信窓を再開。
- **再マッチ制限:** 前回マッチから **24時間**（シーズン最終日マッチ起点は **72時間**）未満は不可（チャット窓と同じ）。`lib/match-chat-window.ts`。
  - **運営スタッフ（`admins/{uid}`）は再マッチの時間制限をスキップ**（動作確認用）。`registerLinkByPeerCode(..., { bypassCooldown })` に `isStaff` を渡す。
- 相手の `linkedFrom` は読み取り不可（本人のみ）。`registerLinkByPeerCode` は自分の `outboundLinks`／`linkedFrom` のみ読み、相手側ミラーは update→（無ければ）create で書く。
- マッチングコード入力: 英数字6文字・単一 input。予測変換キーボードでも反映されるよう composition 中も表示を更新し、確定（onComplete）のみ composition 終了後。貼り付け `LOBBY:XXXXXX` 可。
- マッチ処理は 15 秒で必ず結果を返すタイムアウト保険あり（`lib/promise-timeout.ts`、「処理中」固まり防止）。
- 各種設定の規約 URL: `.env` の `NEXT_PUBLIC_LOBBY_*_URL`（未設定時は laughgaki-store の既定 URL）。
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
| 2026-05-20 | ユーザー向けは通報のみ（自動ブロック廃止。「通報・ブロック」表記をやめる） |
| 2026-05-27 | マイページ B案: 各種設定＝規約リンク一覧、表示名・居住地はプロフィール編集。相性質問はチュートリアル同様のボタン選択（iOS） |
| 2026-05-27 | 再マッチ: 双方向リンク判定、24h/72h クールダウン、コード入力1欄化。ボトムシートのスマホスクロール・規約 URL 本番フォールバック |
| 2026-06-01 | ホーム: シーズン残日数のイボリーアラート枠を削除（赤帯のみ）。チャット: 一覧・会話の相手／自分アイコンをプロフィール写真（未設定時はイニシャル）に統一 |
| 2026-06-02 | マッチング修正: 相手の linkedFrom 読み取り廃止（即失敗の解消）、コード入力の予測変換対応、処理タイムアウト保険。運営は再マッチ24h制限をスキップ可能に |
| 2026-06-02 | チャット既読を実データ化: 相手の最終既読時刻（`chatThreads.lastReadLow/High`）と比較し、読まれた自分の最新メッセージにのみ「既読」を表示。ルールで各自の既読更新のみ許可。`npm run deploy:rules` 要 |
| 2026-06-01 | シーズン表示を Firestore `seasons` に移行（管理サイトで CRUD）。`users.currentSeasonId`・チケット `seasonId` で同時期複数開催・同年複数回に対応 |
| 2026-06-01 | 参加人数・No. をシリアル引き換え順で自動化。管理サイトでシリアル発行（nagoya202601xabcd 形式）。手動の参加人数入力は廃止 |
| 2026-06-01 | 仕様正本 `docs/SEASON_AND_TICKET_SPEC.md` を追加（シーズン・シリアル・採番・運用） |
| 2026-06-01 | シリアルは運営が管理サイトで手入力登録（自動発行なし）と仕様書に明記 |
| 2026-06-04 | プロフィールの「みんなへのひとこと」(bio) を20字以内に変更。マッチング履歴のアイコン上・チャット一覧のアイコン横に吹き出しで表示（`ProfileHitokotoBubble`／`lib/hitokoto.ts`） |
| 2026-06-04 | お知らせの予約配信に対応: 一覧クエリを `publishedAt<=now` で絞り、未来日時（予約・繰り返し）は時刻到来まで非表示。`useAnnouncementUnread` は約60秒ごとに再購読し到来分を反映（管理は管理サイトで設定） |
| 2026-06-06 | ホームUI調整: No.000 を明朝（Noto Serif JP）に個別指定、QRアイコンを finder パターン付きに刷新、スキャンをカメラアイコンに、お知らせ見出し下の最新タイトルのプレビュー文を削除。シーズン未登録時は「シーズン未登録」表示＋残り日数の赤帯を非表示（`SEASON_FALLBACK_ID` で判定） |
| 2026-06-06 | ブランドロゴデータを `public/brand/`（`red/`・`white/`・`lobby_logo.ai`）に格納。基本は RED を使用。ホームの「Lobby」を文字からワードマーク画像（`/brand/red/logotype_2_red.png`）に差し替え。`logotype_*`=文字、`logomark_*`=Lマーク、`logo*`=組み合わせ |
| 2026-06-06 | 画面の地を光沢感のある赤→オレンジのグラデーションに（`html` に固定背景、`--lobby-screen-bg` は透過化）。地に直接乗る文字（ホームのシーズン見出し・残り日数帯、マイページのタイトル/表示名/No./相性導線）は白系に調整して可読性を確保。カード上の文字は従来どおり |
| 2026-06-06 | 表示文言を変更: 「チャット」→「レター」、「デートお誘い券／お誘い券」→「招待状」（タブ名・見出し・ボタン・通知/エラーメッセージなど表示文字のみ。コレクション名・変数・ファイル名は据え置き） |
