# 本人確認書類の保管（3年）— 設計メモ

最終更新: 2026-05-19

## 採用方針（決定）

**A: 現行の Firebase Storage + Firestore `identitySubmittedAt` で運用する。**

- 1000〜5000人規模でも Storage 性能・容量は問題になりにくい（詳細は下記「スケール見積もり」）。
- 受領日時は提出時に `serverTimestamp()` で既に保存済み。
- B（専用バケット・提出履歴）は、監査で提出履歴の厳密な一覧が必要になった段階で検討。

## 法的背景（要確認）

特定商取引・マッチングサービス等の本人確認義務に伴い、**顔写真付き本人確認書類の画像**と**それを受け取った日時**を、一定期間（実務上 **3年** とされることが多い）保管する必要がある、という理解で進めています。

> **注意:** 最終的な保存期間・保存項目は弁護士・コンプライアンス担当の確認を推奨します。本ドキュメントはエンジニアリング上の保管場所の選択肢です。

## 現状（2026-05 時点）

| 項目 | 実装 |
|------|------|
| 提出 UI | `/onboarding` — 顔写真付き身分証（運転免許証・マイナンバーカード・パスポート等） |
| 画像の保存先 | Firebase Storage `users/{uid}/identity/{timestamp}_{random}.jpg` 等 |
| 受領日時 | Firestore `users/{uid}.identitySubmittedAt`（サーバー時刻） |
| 運営閲覧 | `lobby-admin` — 署名付き URL（15分）で画像表示 |
| 本名 | `users/{uid}.legalName`（登録時固定・変更不可）— 書類と突合 |

### 現状のギャップ（要対応）

1. **ユーザーによる Storage 削除** — 以前はクライアントから `identity/` 配下を削除可能だった。**3年保管と矛盾**するため、ルールでユーザー削除を禁止済み（削除は Admin SDK / 期限後バッチのみ想定）。
2. **再提出時の旧ファイル** — 却下後に再アップロードすると新パスが `idDocumentPath` に上書きされ、旧画像は Storage に残るが Firestore から参照しづらい。**監査用に提出履歴コレクションを分ける**案を推奨（下記 B）。
3. **3年経過後の自動削除** — 未実装。GCS ライフサイクルまたは Cloud Functions + Scheduler で実装する。

---

## 保管場所の選択肢

### A. 現行バケットのまま（Firebase Storage = GCS）

**メリット:** 追加コスト・実装が最小。既に `identity-upload.ts` と管理画面が動いている。

**やること:**

- GCS **Object Lifecycle**: カスタムメタデータ `retentionUntil` またはオブジェクト作成日 + 1095日で削除（または Nearline/Coldline へ移行後削除）。
- Firestore に `identitySubmittedAt` を正とする監査ログ（既存）。
- ユーザー削除禁止（`storage.rules`）、運営のみ署名 URL で閲覧。

**デメリット:** デフォルトバケットにアプリ用画像と混在。アクセスログ・暗号化ポリシーをバケット単位で分けにくい。

**向いているケース:** 初期リリース〜数千人規模（**本プロジェクトは A を採用**）。

### スケール見積もり（A）

| 規模 | 画像容量目安（1人2MB・1回提出） | 備考 |
|------|--------------------------------|------|
| 1,000人 | 約 2GB | Storage 料金・性能とも余裕 |
| 5,000人 | 約 10GB | ボトルネックは審査の人力・pending 一覧運用 |
| 5,000人/年×3年保管 | 最大 約 30GB（再提出なし） | 3年後削除はライフサイクル or バッチで対応 |

---

### B. 専用バケット + 提出履歴コレクション（将来オプション）

**構成例:**

```
gs://lobby-identity-prod/
  {uid}/{submissionId}/document.jpg

Firestore: identitySubmissions/{submissionId}
  uid, storagePath, receivedAt (Timestamp), status, legalNameSnapshot
```

**メリット:**

- 3年保管対象だけ IAM・ライフサイクル・ログを分離できる。
- 再提出・却下でも **提出ごとに receivedAt とファイルが残る**（監査に強い）。
- 削除は Cloud Functions（`receivedAt + 3年`）のみ。

**デメリット:** アップロードを Admin 経由にするか、クライアントから専用バケットへのアップロード用ルール・CORS の追加が必要。

**向いているケース:** 本番ユーザーが増えた後、コンプライアンス監査を意識する段階。

---

### C. 外部 KYC サービス（Stripe Identity、Trustdock 等）

**メリット:** 保管期間・本人確認フローをベンダーに委託。

**デメリット:** 月額・件数課金、Shopify チケット照合フローとの統合設計が別途必要。

**向いているケース:** 運営の目視確認を減らしたい・スケール優先。

---

## ロードマップ（A 採用後）

| フェーズ | 内容 |
|----------|------|
| **済** | A 採用。提出 UI、`identitySubmittedAt`、`legalName`、Storage ユーザー削除禁止 |
| **短期** | 運営手順: 承認/却下時も Storage ファイルは消さない。却下は `identityStatus=rejected` のみ |
| **中期** | GCS ライフサイクル（またはバッチ）で **提出から3年後** のオブジェクト削除 |
| **必要時のみ** | B（専用バケット・提出履歴）— 監査で再提出履歴の厳密管理が必要になったら |

---

## 運営向けチェックリスト

- [ ] Firebase Console で `ticketCodes` に `intendedGender` を付与
- [ ] 本人確認審査で **登録本名（legalName）** と書類記載名を目視照合
- [ ] 承認後も Storage 上の画像を **削除しない**（3年保管）
- [ ] 3年経過後の削除方法（ライフサイクル or 年次バッチ）を決め、カレンダーに登録

## 関連ファイル

- `lib/identity-upload.ts` — アップロード
- `storage.rules` — `users/{uid}/identity/*`
- `lobby-admin` — `/dashboard/identity`
- `LOBBY_FINAL_SPEC.md` §2 — 登録・本人確認ゲート
