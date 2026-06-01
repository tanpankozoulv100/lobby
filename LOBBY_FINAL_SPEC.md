# Lobby 完成系仕様（固定版）

最終更新: 2026-05-12（Functions: 通報カウント・停止・コホート反転／FINAL SPEC 反映）

このドキュメントは、スレッドをまたいでも参照できる「完成系の仕様メモ」です。  
企画メモとの差分が出た場合、実装の正本は `firestore.rules` と `lib/lobby-firestore-types.ts` を優先します。

**Figma / PDF / スクショと実装が食い違うとき**は `docs/DESIGN_IMPLEMENTATION_POLICY.md` に従い、**既存の Cursor 実装を優先**する（デザイン反映前に変更一覧でユーザー確認）。

## 1. プロダクト前提

- Lobby は「30日間の主人公体験」を目指すシーズン制コミュニティアプリ。
- 技術基盤は Next.js + Firebase（Auth / Firestore）。
- 運営データ（イベント、告知、各種管理データ）は Console 投入を基本にしつつ、必要箇所は運営UIで補助する。
- **運営用の管理コンソールは、ユーザー向けアプリとは別サイト（別オリジン・別デプロイ）で作る方針。** 本体アプリ内に `/admin` を同居させない（攻撃面・権限・デプロイ監査を分離するため）。

## 2. 利用開始ゲート（必須）

### 2.1 新規登録（プロフィール）

Shopify でチケット購入者のみ利用可。**新規登録時**に次を収集し `users/{uid}` に保存する。

| 項目 | フィールド | 変更 |
|------|------------|------|
| メール・パスワード | Firebase Auth | — |
| 本名 | `legalName` | **登録後は変更不可**（本人確認書類と照合） |
| ユーザー名（表示名） | `displayName` | マイページから編集可 |
| 性別 | `gender`: `male` \| `female` | **登録後は変更不可** |
| 生年月日 | `birthDate`: `YYYYMMDD`（年齢は算出表示） | **登録後は変更不可** |
| 居住地 | `prefecture`（都道府県） | マイページから編集可 |

### 2.1.1 マイページ・相性質問（プロフィール編集）

全ユーザーが **相性質問12問**（`compatibilityAnswers`: `q1`〜`q12` → 選択肢 id）に回答する。マッチした相手と **同じ回答の設問数** で相性％を表示（0問=0% … 12問=100%。中間値はデザイン正本の段階表 — `lib/compatibility-match.ts`）。

| 項目 | フィールド | 変更 |
|------|------------|------|
| プロフィール写真 | `avatarPath`（Storage） | マイページ「プロフィール編集」 |
| 背景画像 | `coverPath`（Storage） | 同上 |
| みんなへのひとこと | `bio` | 同上 |
| 相性質問 | `compatibilityAnswers` | 同上 |

表示名・居住地（都道府県）は **マイページ → プロフィール編集** の「アカウント」欄から編集。**各種設定** は規約・ポリシー等の外部リンク一覧（`lib/lobby-settings-links.ts`、URL は `NEXT_PUBLIC_LOBBY_*_URL` または既定値）。マッチ相手は `hasMatchWith` により相手の `displayName` / `compatibilityAnswers` 等を読み取り可能（相性％算出用）。

**初回チュートリアル:** 本人確認・チケット完了後、`/tutorial` で12問すべて必須回答（選択式・1問ずつ）。完了後に `/dashboard`。未完了のままダッシュボード直リンクは `/tutorial` へ戻す。回答の変更はマイページ「プロフィール編集」。

### 2.2 オンボーディング（本人確認 → チケット）

登録後は `/onboarding` へ。以下がそろってダッシュボード入場:

- 本人確認承認（`identityStatus == "approved"`）— **顔写真付き本人確認書類**をアップロードし、運営が登録本名と目視照合。画像は Firebase Storage、受領日時は `identitySubmittedAt`。**3年間保管（方針 A）** — `docs/IDENTITY_DOCUMENT_RETENTION.md`
- シーズンチケット確認済み（`ticketRedeemedAt` が存在）

**チケット照合:** `ticketCodes/{code}` に `intendedGender`（`male` / `female`）を運営が付与。引き換え時にユーザーの `gender` と一致しない場合は拒否（男性用・女性用で Shopify 価格が異なるため）。
- **運営・テスト用（本番推奨）**: Firestore の **`admins/{uid}`** に、対象ユーザーの Firebase Auth UID と同じドキュメント ID で 1 件追加（中身は空で可）。ログイン後、アプリが `admins` を読み、本人確認・チケットをスキップしてダッシュボードへ入れる。付与は Console / Admin SDK のみ（クライアントからは作成不可）。初回は **会員登録・ログインのみ** でよい（書類不要）。オンボーディング画面に UID が表示されるので、運営が Console で `admins` を作れる。
- **ローカル開発のみ**: `NEXT_PUBLIC_LOBBY_DEV_BYPASS_ONBOARDING=true` で全員スキップ。`NEXT_PUBLIC_LOBBY_ONBOARDING_BYPASS_UIDS` は UID 列挙の暫定用（**クライアントに載るため本番非推奨**）。本番 Vercel では上記 **`admins` のみ** を使う想定。

## 3. イベント

- 参加者番号 **No.001〜** は、本人確認・チケット完了後に **初めてダッシュボードへ入った順** で付与（`system/participantCounter`）。**001–999 は3桁表示、1000以降は4桁表示**。運営（`admins`）は **No.000** 固定。
- 参加者は A/B コホートで分岐。
- 1日ごとに朝/昼/夜（`morning|afternoon|evening`）の枠を提示。
- 枠は `events/{eventId}/slotChoices/{slotId}` で管理し、同一 `(dateKey, period, cohort)` は最大2件（`lineIndex 0/1`）。
- 参加は任意（不参加可）。

## 4. チャット

- 下部ナビの「チャット」タブは常時表示。
- 会場でQR交換してマッチした相手とのチャットを 24時間限定で解放（送信のみ。最終日マッチは 72時間）。
- **送信期限後も** 同じ相手との **メッセージ履歴は閲覧可**（読み取り専用）。一覧の「過去のチャット」から開く。
- **再マッチ**（同じ相手の **QR をスキャン／コードを再入力**）で `lastMatchedAt` を更新し、**同じ `chatThreads` スレッドで続きから送信**できる（24/72h ウィンドウが再開）。自分の QR を相手に見せるだけでは再マッチにならない。
- **再マッチの間隔:** 前回マッチ（`max(createdAt, lastMatchedAt)`）から **24時間未満**（最終日マッチ起点は **72時間未満**）は再マッチ不可（チャット送信窓と同じ）。実装: `lib/match-chat-window.ts` → `registerLinkByPeerCode`。
- マッチの認識は **outboundLinks** と **linkedFrom** の両方。チャット解放起点は `max(createdAt, lastMatchedAt)`。
- マッチングコード入力は英数字6文字・単一フィールド（`components/lobby-connection-code-input.tsx`）。iOS 日本語変換での文字重複を避ける。
- メッセージは Firestore `chatThreads/{participantLow_participantHigh}/messages`（リアルタイム購読）。運営（`admins/{uid}`）は期限なしでマッチ相手とチャット可能。
- 再マッチ時は Firestore ルールで `outboundLinks` / `linkedFrom` の `lastMatchedAt` 更新を許可（要 `firestore.rules` デプロイ）。

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
- **通報（ユーザー向けにブロック機能は提供しない）**
  - `userReports/{reportId}` — `reporterUid`, `reportedUid`, `reasonCode`, `note`, `createdAt`（運営記録・件数カウント・利用停止）
  - `blockedUsers` — データモデルは残置（ユーザーアプリからは作成しない。他アプリ型のブロックは採用しない）

## 7. 安全系

### 7.1 目標（プロダクト）

**通報の位置づけ（メモ）**  
他アプリの「ブロック」とは別物。**合わない・距離を置きたい**相手向けではなく、**迷惑行為・嫌がらせ・規約違反など、運営が対応すべき事案**向け。気が合わないだけでは通報しない想定（UI 文言でもその趣旨を示す）。

- **MVP（ユーザーアプリ）**: 連携一覧・チャットから **通報**のみ（相手の自動ブロックはしない）。通報累計・コホート分離は Cloud Functions。利用停止は運営判断＋閾値。
- 通報関係者同士は **グループ分離**（コホート等の割り当てで衝突しないようにする）。
- **通報が一定回数（例: 3回）に達したら利用停止** — `users/{uid}.reportReceivedCount` を Cloud Functions が増分し、閾値で `accountStatus: "suspended"` を付与。アプリは停止画面を表示（クライアントからの改ざん不可）。
- **通報ペアのコホート分離** — 通報者と被通報者のハッシュコホートが同一のとき、被通報側に `cohortFlipActive: true` を付与。UI は `getEffectiveLobbyCohortForSeason`（`lib/lobby-cohort.ts`）で A/B を反転表示。
- **通報 / モデレーション** — ユーザー UI は「通報」のみ。モデレーションは管理サイト。

### 7.2 実装順の方針（管理サイトより先）

**別サイトの運営コンソールを作り始める前に、安全系の土台を先に整える。**  
理由: 管理画面は「通報キュー」「ユーザー停止」「モデレーション」など安全データの閲覧・処理が中心になり、データモデルとルールが未定だとコンソールを二度手間で作り直すため。

推奨する先順（概要）:

1. **データモデル** — 例: `reports`（通報）、`blocks`（ブロック）、必要なら `userModerationState` 等。誰が作成・誰が読めるかを一文で決める。
2. **Firestore セキュリティルール** — ユーザーは自分の通報/ブロックのみ作成可、運営は別経路（Admin SDK またはスタッフ用 read）など。
3. **ユーザーアプリ側の最小 UI** — 通報・ブロックの入口（チャット/プロフィール/マッチ周りから辿れること）。
4. **集計・利用停止** — **`functions/` の `onUserReportCreated`**（Cloud Functions + Admin SDK）で `reportReceivedCount` を増分し、**3件で `accountStatus: "suspended"`**。デプロイ: ルートで `npm run deploy:functions`（Blaze 課金プロジェクトが必要）。ローカル検証は Firebase Emulator 利用可。実装は **`firebase-functions/v1` の Firestore トリガー（第1世代）** とし、Gen2 + Eventarc の初回デプロイで出やすい「Eventarc Service Agent / Permission denied」の伝播待ちを避ける。
5. **コホート分離** — 上記 Functions が **同一コホートの通報ペア**に対し `cohortFlipActive` を立てる。イベント UI は `useEventCalendarSlots(..., cohortFlipActive)` 経由で反映。

### 7.3 管理サイトとの関係

- 運営コンソール（別サイト）は、上記の **通報キューの閲覧・対応、ユーザー停止、お知らせ CRUD** などを載せる。
- 安全系の **ルールと Functions が先** にあり、そのあとコンソールがそれを呼ぶ形にすると移行が楽。

## 8. 運営コンソール（管理サイト）

- **ユーザー向け Lobby アプリとは別リポジトリ／別 URL でホスティングする**（例: `admin.lobby.example` や別 Vercel プロジェクト）。実装: `lobby-admin`。
- 認可は **Firebase Auth + 運営のみ**（Custom Claims、`admins/{uid}`、または両方の併用など）。詳細は実装時に本リポの `firestore.rules` の `isLobbyStaff()` と揃える。
- 本番データへの書き込みは原則 **Admin SDK（サーバー）** 経由にし、ブラウザにサービスアカウント鍵を置かない。
- **画面・運用の指示書（製品要件）:** `lobby-admin/docs/ADMIN_INSTRUCTIONS.md`（チャット指示・バックログ・実装状況の正本）。
- **更新ポリシー:** `docs/SPEC_MAINTENANCE_POLICY.md` — コード変更時は指示書も同時に更新する。
- **週次 A/B + 表示週:** `lobby-admin` の `GET /api/cron/weekly-operations`（Vercel Cron・木曜 JST 想定）。手動は緊急時のみ。詳細は `lobby-admin/docs/ADMIN_INSTRUCTIONS.md` §3.1。
- **スプレッドシート連携:** `POST /api/staff/event-slots`（`lobby-repo`）または `POST /api/admin/event-slots/intake`（管理サイト）。詳細は管理サイト指示書 §3.2。
- **管理画面:** ユーザー一覧、イベントカレンダー、マッチ日別集計、通報日別 — 同指示書 §2。

