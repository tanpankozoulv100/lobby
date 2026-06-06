# イベント公開（週次運用）引き継ぎ依頼書

最終更新: 2026-06-06 / 依頼者: 小島（現・開発担当）

---

## 0. この文書の目的

ユーザー画面（ロビーアプリ）の **イベントメニューでイベントが表示されない** 状態になっています。
調査の結果、コードの結線（イベント／枠／表示期間の紐付け）は正しく動作しており、
**「その週を公開する週次運用が動いていない（＝公開設定・サービスアカウントが未構成）」** ことが原因と判明しました。

この運用部分は、初期に実装・運用してくださっていた**過去の運営者の領域**のため、
引き継ぎのために必要事項をまとめました。**この .md をそのまま過去の運営者（およびそのAI）に渡してください。**

末尾の「お願いしたいこと（チェックリスト）」に答え／対応いただければ復旧できます。

---

## 1. 前提情報

| 項目 | 値 |
|---|---|
| GitHub リポジトリ | `dino0402r/Lobby` |
| Firebase プロジェクト | `lobby-72909` |
| 本番ホスティング | Vercel（プロジェクト名 `lobby`） |
| 本番URL | https://lobby-mu-six.vercel.app |

直近のコミット `feat(events): 週次表示を1週間限定に厳格化` により、
**イベントは「公開された1週間分」だけを厳格に表示する**仕様になっています。
その「1週間分の公開」が未実行だと、カレンダーには何も出ません
（"今週のイベントは準備中です…" のバナーが出ます）。

---

## 2. イベントが画面に出る条件（4つすべて必要）

ユーザーがある日付を選んでイベント（行き先）が表示されるには、Firestore に以下が **すべて** そろっている必要があります。

1. **公開イベント**: `events/{eventId}` に `isPublished: true`（厳密に boolean の true）。
2. **枠（行き先）**: `events/{eventId}/slotChoices/{id}` に、表示したい日付・時間帯・グループの枠。
3. **表示期間**: `eventDisplayWindow/current` に、その週（日〜土）の範囲。
4. **ユーザーの週グループ**: `users/{uid}/cohortWeeks/{weekKey}` にその週の A/B 割り当て。
   （無い場合は UID ハッシュのフォールバックになり、枠の cohort と食い違うと表示されません）

> 3 と 4 は、後述の **週次公開バッチ** が自動で書き込みます。
> 1 と 2 は、スタッフ用イベント画面、または Google スプレッドシート（GAS）経由で登録します。

---

## 3. データスキーマ（過去の登録方法がこの形に一致しているか確認してください）

### 3-1. `events/{eventId}`
| フィールド | 型 | 必須 | 備考 |
|---|---|---|---|
| `title` | string | ✅ | 空不可 |
| `isPublished` | boolean | ✅ | **必ず true（文字列 "true" ではダメ）** |
| `startsAt` | Timestamp | ✅ | |
| `endsAt` | Timestamp | 任意 | |
| `description` | string | 任意 | |
| `locationSummary` | string | 任意 | |

### 3-2. `events/{eventId}/slotChoices/{id}`（＝行き先の枠）
| フィールド | 型 | 必須 | 取りうる値 |
|---|---|---|---|
| `dateKey` | string | ✅ | 8桁 `YYYYMMDD`（例 `20260607`） |
| `period` | string | ✅ | **`morning` / `afternoon` / `evening` のみ**（`noon` 等は不可） |
| `cohort` | string | ✅ | **`A` / `B` のみ** |
| `lineIndex` | number | ✅ | `0` または `1` |
| `destinationLabel` | string | ✅ | 空不可（行き先名） |
| `startTime` | string | 任意 | `HH:MM` |
| `eventDetail` | string | 任意 | |
| `sortOrder` | number | 任意 | |

> 時間帯の対応: `morning`=08:00–10:59 / `afternoon`=11:00–16:59 / `evening`=17:00–22:00

### 3-3. `eventDisplayWindow/current`（表示する1週間）
| フィールド | 型 | 備考 |
|---|---|---|
| `weekKey` | string | その週の日曜日の `YYYYMMDD` |
| `visibleFromDateKey` | string | 週の開始（日曜）`YYYYMMDD` |
| `visibleToDateKey` | string | 週の終了（土曜）`YYYYMMDD` |
| `updatedAt` | Timestamp | |

### 3-4. `users/{uid}/cohortWeeks/{weekKey}`（その週のA/B）
| フィールド | 型 |
|---|---|
| `weekKey` / `weekStartDateKey` / `weekEndDateKey` | string |
| `cohort` | `A` / `B` |
| `generatedAt` | Timestamp |

---

## 4. 週次公開バッチ（3-3 と 3-4 を自動生成する仕組み）

リポジトリにエンドポイントが実装済みです。

- 実装: `lib/server-weekly-operations.ts`（`runWeeklyCohortAndPublishAutomation`）
- API: `app/api/admin/weekly-operations/route.ts`
- 呼び出し: `POST /api/admin/weekly-operations`
  - ヘッダー: `x-lobby-cron-token: <LOBBY_WEEKLY_CRON_TOKEN>`
  - ボディ（任意）: `{ "targetSundayDateKey": "YYYYMMDD" }`（省略時は**翌週の日曜**を対象）
- 動作: 指定週の `eventDisplayWindow/current` を更新し、対象ユーザー全員の `cohortWeeks/{weekKey}` に A/B を割り当て。
- 想定運用: **毎週木曜に cron で実行**し、翌週（日〜土）分を公開。

### このバッチに必要なサーバー環境変数（Vercel）
| 変数名 | 用途 |
|---|---|
| `FIREBASE_ADMIN_CREDENTIALS_JSON`（または `FIREBASE_SERVICE_ACCOUNT_KEY`） | Firebase Admin SDK のサービスアカウント鍵（JSON全文） |
| `LOBBY_WEEKLY_CRON_TOKEN` | 上記APIの認証トークン（任意のランダム文字列） |

> 現状、本番 Vercel にはこの2つが **未設定** です（`NEXT_PUBLIC_FIREBASE_*` と onboarding バイパスのみ設定済み）。
> そのため週次公開が一度も実行できず、`eventDisplayWindow/current` が空のままになっています。

> 補足: リポジトリに `vercel.json` や **Vercel Cron の定義は存在しません**。
> もしこれまで自動実行していたなら、外部（GAS の時刻トリガー / GitHub Actions / 外部 cron サービス等）から
> 上記APIを叩いていたはずです。その所在を「5-A」で教えてください。

---

## 5. 過去の運営者へ「お願いしたいこと」チェックリスト

### A. 教えてほしい（現状把握）
- [ ] **これまでイベントはどうやって公開していましたか？**
  - 週次公開バッチ（`/api/admin/weekly-operations`）を **cron / GitHub Actions / Vercel Cron / GAS の時刻トリガー** のどれで叩いていましたか？その設定場所は？
  - それとも `eventDisplayWindow/current` を **手動 or GAS で直接** Firestore に書いていましたか？
- [ ] **枠（slotChoices）の登録方法**は、スタッフ画面ですか、Google スプレッドシート（GAS: `scripts/google-sheets/event-input-single-sheet.gs`）ですか？
  - スプレッドシートの場合、その**シートのURL**と**運用手順**を共有してください。
- [ ] 現在 Firestore に **公開イベント（isPublished:true）** と **直近の週の slotChoices** は登録されていますか？登録済みの**週／日付**を教えてください。

### B. 渡してほしい（資格情報・設定）
- [ ] **Firebase サービスアカウント鍵（JSON）**
  - Firebase Console → プロジェクト `lobby-72909` → 歯車（プロジェクトの設定）→「サービスアカウント」→「新しい秘密鍵を生成」
  - ※機密情報です。安全な方法（パスワード付き共有など）で渡してください。コミットはしません。Vercelの暗号化環境変数にのみ保存します。
- [ ] 既存の **cron / GAS / GitHub Actions の設定**（あれば）の場所とアクセス権、または設定内容（叩いているURL・トークン・スケジュール）。

### C. （過去の運営者が自分で対応してくれる場合）そのまま復旧する手順
1. Vercel（プロジェクト `lobby`）の環境変数（Production）に追加:
   - `FIREBASE_ADMIN_CREDENTIALS_JSON` = サービスアカウントJSON全文
   - `LOBBY_WEEKLY_CRON_TOKEN` = 任意のランダム文字列
2. 本番を再デプロイ（環境変数反映のため）。
3. 公開したい週を指定して週次公開を実行（例: 2026/6/7 日曜開始の週）:
   ```bash
   curl -X POST https://lobby-mu-six.vercel.app/api/admin/weekly-operations \
     -H "Content-Type: application/json" \
     -H "x-lobby-cron-token: <LOBBY_WEEKLY_CRON_TOKEN>" \
     -d '{ "targetSundayDateKey": "20260607" }'
   ```
   レスポンスに `visibleFromDateKey` / `visibleToDateKey` / `countA` / `countB` が返れば成功です。
4. その週の日付に **slotChoices が登録済み** であることを確認（未登録なら各日付は「開催はありません」のまま）。
5. 毎週木曜に上記APIが自動実行されるよう cron を設定（既存があれば再有効化）。

---

## 6. つまずきやすいポイント（確認用）

- `isPublished` が文字列 `"true"` になっている → イベント自体が一覧に出ない（boolean の true 必須）。
- `period` が `noon` 等 → 枠が無効扱い。`morning/afternoon/evening` のみ有効。
- 枠の `cohort`（A/B）と、その週のユーザー割り当て（cohortWeeks）が食い違う → そのユーザーには出ない。
- `eventDisplayWindow/current` の週範囲が**過去や別週** → 今のカレンダーには何も出ない。
- Firestore の**複合インデックス未作成** → `slotChoices`（`dateKey, period, cohort, lineIndex` の並び替え）取得が失敗。
  失敗時はブラウザのコンソールにインデックス作成リンクが出るので、それを作成。

---

## 7. 連絡先

不明点はこの文書を渡した現・開発担当（小島）まで。
できれば「A. 現状把握」への回答だけでも先にいただけると、こちらで残りを進められます。
