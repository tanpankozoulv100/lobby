# Lobby 完成系仕様（固定版）

最終更新: 2026-05-12（Functions: 通報カウント・停止・コホート反転／FINAL SPEC 反映）

このドキュメントは、スレッドをまたいでも参照できる「完成系の仕様メモ」です。  
企画メモとの差分が出た場合、実装の正本は `firestore.rules` と `lib/lobby-firestore-types.ts` を優先します。

## 1. プロダクト前提

- Lobby は「30日間の主人公体験」を目指すシーズン制コミュニティアプリ。
- 技術基盤は Next.js + Firebase（Auth / Firestore）。
- 運営データ（イベント、告知、各種管理データ）は Console 投入を基本にしつつ、必要箇所は運営UIで補助する。
- **運営用の管理コンソールは、ユーザー向けアプリとは別サイト（別オリジン・別デプロイ）で作る方針。** 本体アプリ内に `/admin` を同居させない（攻撃面・権限・デプロイ監査を分離するため）。

## 2. 利用開始ゲート（必須）

- まずログイン/新規登録。
- 以下2条件がそろってダッシュボード入場:
  - 本人確認承認（`identityStatus == "approved"`）
  - シーズンチケット確認済み（`ticketRedeemedAt` が存在）
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
- 会場でQR交換してマッチした相手とのチャットを 24時間限定で解放。
- シーズン最終日に成立したマッチは 72時間解放（最終マッチング特例）。
- 24時間が過ぎた相手とのチャットは自動的に未解放扱い。
- 現在の土台実装では、マッチ履歴（`outboundLinks`）の `createdAt` を解放起点として扱う。
- メッセージは Firestore `chatThreads/{participantLow_participantHigh}/messages`（リアルタイム購読）。運営（`admins/{uid}`）は期限なしでマッチ相手とチャット可能。

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
- 通報
  - `userReports/{reportId}` — `reporterUid`, `reportedUid`, `reasonCode`, `note`, `createdAt`（本人は自分の通報のみ read、運営スタッフは全件 read）
- ブロック
  - `users/{uid}/blockedUsers/{blockedUid}` — `createdAt` のみ（本人のみ read / create / delete）

## 7. 安全系

### 7.1 目標（プロダクト）

- **MVP（ユーザーアプリ）**: 連携一覧から **通報送信**・**ブロック／解除**、チャット解放・デート券送信から **ブロック相手の除外**（サーバー側の `dateInvites` 作成ルールでもブロック相手への送信を拒否）。
- 通報関係者同士は **グループ分離**（コホート等の割り当てで衝突しないようにする）。
- **通報が一定回数（例: 3回）に達したら利用停止** — `users/{uid}.reportReceivedCount` を Cloud Functions が増分し、閾値で `accountStatus: "suspended"` を付与。アプリは停止画面を表示（クライアントからの改ざん不可）。
- **通報ペアのコホート分離** — 通報者と被通報者のハッシュコホートが同一のとき、被通報側に `cohortFlipActive: true` を付与。UI は `getEffectiveLobbyCohortForSeason`（`lib/lobby-cohort.ts`）で A/B を反転表示。
- **ブロック / 通報 / モデレーション** を段階的に実装する。

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

- **ユーザー向け Lobby アプリとは別リポジトリ／別 URL でホスティングする**（例: `admin.lobby.example` や別 Vercel プロジェクト）。
- 認可は **Firebase Auth + 運営のみ**（Custom Claims、`admins/{uid}`、または両方の併用など）。詳細は実装時に本リポの `firestore.rules` の `isLobbyStaff()` と揃える。
- 本番データへの書き込みは原則 **Admin SDK（サーバー）** 経由にし、ブラウザにサービスアカウント鍵を置かない。

