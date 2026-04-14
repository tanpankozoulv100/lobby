# Lobby アプリ開発 — Agent 引き継ぎ書

最終更新: 2026-04-08（お知らせ `announcements` を追加）

---

## 1. プロジェクトの目的

- **Lobby** はオフライン・マッチングイベント向けのサービス（らふがき事業）。当初はココナラ経由で **Adalo** 上にプロトタイプが存在したが、品質・保守のため **自前コード（Next.js + Firebase）で 0 から再構築**する方針。
- 配信の狙い: **Web を本体**とし、のち **Capacitor 等で iOS / Android ストア**も視野（確定実装は未着手）。
- 想定規模: 法人運用、**同時利用 1000〜2000 人規模**でも Firebase は現実的な選択。

---

## 2. リポジトリの場所

| 種別 | パス |
|------|------|
| コード（このリポジトリ） | `Takashi Kojima Brain/らふがき事業/Lobby/lobby-app`（Obsidian vault 内） |
| 絶対パス（参考） | `/Users/takashikojima/Documents/Obsidian/Takashi Kojima Brain/らふがき事業/Lobby/lobby-app` |

**注意**: vault と同じツリーに `node_modules` がある。Obsidian / iCloud 同期を使う場合は `node_modules` や `.next` の除外を推奨。

---

## 3. 技術スタック

| 領域 | 選定 |
|------|------|
| フレームワーク | **Next.js 16**（App Router） |
| 言語 | TypeScript |
| スタイル | Tailwind CSS v4 |
| 認証・BaaS | **Firebase**（現状は **Authentication（メール／パスワード）** のみ） |
| パッケージマネージャ | npm |

**未着手だが計画上必要になりやすいもの**

- **Firestore** — 実装済み: `users`、`events`、`announcements`、`connectionCodes`、`outboundLinks`＋`linkedFrom`（連携の相互表示）、`boardPosts`（参加者掲示板・読み取りはログイン済み）。未実装: モデレーション、スコア、QR 等
- **Cloud Functions**（集計・通知・整合性が厳しい処理）
- **セキュリティルール** — Firestore は `firestore.rules` をリポジトリに同梱（Storage は未着手）
- **本番ホスティング**（Vercel 等）とカスタムドメイン

---

## 4. 現状実装されているもの

### ルーティング

| パス | 説明 |
|------|------|
| `/` | トップ。Firebase 接続状態、未ログイン時はログイン／新規登録リンク、ログイン済みはダッシュボードへ |
| `/login` | メール・パスワードログイン。既ログインなら `/dashboard` へ |
| `/signup` | 新規登録（パスワード 8 文字以上）。既ログインなら `/dashboard` へ |
| `/dashboard` | **クライアント側**でログイン必須。メール・UID、**プロフィール**、**連携コード／連携登録**、**お知らせ**、**公開イベント**、ログアウト |

### 主要ファイル（読む順の目安）

- `lib/firebase.ts` — Firebase App / Auth / **Firestore** の取得（ブラウザのみ）
- `lib/firestore-users.ts` / `lib/firestore-events.ts` / `lib/firestore-announcements.ts`
- `lib/lobby-firestore-types.ts` — コレクションのフィールド型（ドキュメント用）
- `components/dashboard-profile-section.tsx` / `dashboard-announcements-section.tsx` / `dashboard-events-section.tsx`
- `firestore.rules` / `firestore.indexes.json` — Console または Firebase CLI でデプロイ
- `components/auth-provider.tsx` — `onAuthStateChanged` で `user` / `loading` を提供
- `components/providers.tsx` — ルートで `AuthProvider` をラップ
- `app/layout.tsx` — `<Providers>{children}</Providers>`
- `components/login-form.tsx` / `signup-form.tsx`
- `lib/use-require-auth.ts` — 未ログイン時 `router.replace("/login")`
- `lib/use-redirect-if-authed.ts` — ログイン／新規登録画面用
- `components/home-with-firebase.tsx` — トップ UI（`FirebaseStatus` は `dynamic(..., { ssr: false })`）
- `components/firebase-status.tsx` — 環境変数が揃っているかの表示
- `.env.local.example` — コピーして `.env.local` を作成

### 品質

- `npm run lint` / `npm run build` が通る状態で維持すること。

---

## 5. 環境変数・Firebase Console

1. `.env.local.example` を `.env.local` にコピーし、Firebase の Web アプリ設定を埋める。
2. Firebase Console → **Authentication** → Sign-in method → **メール／パスワード** を有効化（必須）。
3. **Firestore** を有効化し、`firestore.rules` と `firestore.indexes.json` をプロジェクトにデプロイ（プロフィール・お知らせ・イベントに必須。ルール／インデックス更新後は再デプロイ）。
4. **秘密鍵をリポジトリにコミットしない**。`.gitignore` で `.env*` を無視しつつ、`!.env.local.example` はコミット対象。

---

## 6. プロダクト要件の参照先（Obsidian / 同一マシン）

仕様・背景の一次情報は **このリポジトリ外**のメモにある。実装前に該当ファイルを読むとよい。

| 内容 | パス（vault 相対） |
|------|-------------------|
| 方向性・「主人公体験」等 | `Takashi Kojima Brain/らふがき事業/Lobby/議事録/議事録_2026-03-26_Lobby方向性整理・サービス設計.md` |
| 長文議事・過去の仕様メモ | `…/Lobby/議事録/【議事録】Lobby (1).txt` |
| ココナラ開発者とのやり取り | `…/Lobby/アプリ開発/アプリ開発のやり取り` |
| Adalo 納品・アカウントメモ（**機密**） | `…/Lobby/アプリ開発/【Lobby】納品データ.txt` — **チャットに貼らない。必要ならローカルのみ参照** |
| 法務ドラフト | `…/Lobby/法制度/` 配下 |

過去の開発メモでは例として次が挙がっている（**確定仕様ではなく要確認**）:

- ユーザー同士の **連携（コード入力や QR 等）**、**連携数表示**、**全体掲示板／ログ**
- **イベントカレンダー**、**ポイント／チーム集計**
- **運営からの通知**（チャットは当初なしの方向もあった）
- 課金は **外部ストア（Shopify 等）** とアプリ側の紐づけ、という案（要再確認）

---

## 7. 推奨される次の実装順（Agent 向け）

優先度はプロダクト都合で調整してよいが、技術的な依存関係としては以下が自然。

1. ~~**Firestore** 初期モデル~~ — `users` / `events` を実装済み。**拡張**: `links` / `matches`、`announcements` 等（要件に合わせ命名）
2. ~~**セキュリティルール（初版）**~~ — `firestore.rules` をデプロイし動作確認。**追加**で Storage・他コレクション
3. ~~**ダッシュボード**（プロフィール・**連携コード**・お知らせ・イベント）~~ — 実装済み。**次**: 双方向マッチ確定、QR、掲示板、プッシュ通知 等
4. **管理者ロール**（Custom Claims + Functions、または `users.role` + ルールで段階的に）
5. **PWA** / **Capacitor** は Web が安定してから

---

## 8. 旧 Adalo について

- 旧アプリは Adalo 上のプロジェクト（納品データに URL・アカウント記載）。**コードのエクスポートは期待しない**。
- 仕様の取り込みは **画面スクショ・DB 棚卸し**が必要になったが、方針として **0 から設計し直し**中。
- 本番データ移行が必要になった場合は CSV 等のエクスポート有無を Adalo 側で確認し、**UID の再発行**に合わせた移行スクリプトが必要。

---

## 9. コマンド

```bash
cd "/Users/takashikojima/Documents/Obsidian/Takashi Kojima Brain/らふがき事業/Lobby/lobby-app"
npm install
npm run dev    # http://localhost:3000（既定は webpack。Turbopack は npm run dev:turbo）
npm run lint
npm run build
```

**Firestore ルール／インデックスを CLI でデプロイする場合**（初回のみ `npm install -g firebase-tools` と `firebase login`）:

```bash
npm run deploy:firestore
```

`firebase.json` / `.firebaserc` を同梱。デフォルトのプロジェクト ID は `.firebaserc` の値（別プロジェクトなら `firebase use` で切り替え）。

---

## 10. 作業上の約束事

- UI 文言は現状 **日本語**。
- ユーザー向けにパスワードや API キーをログ出力しない。
- 変更は **依頼範囲に集中**し、無関係なリファクタや未依頼のドキュメント乱立を避ける。
- ストア申請時は **マッチング系の審査**（安全対策・通報・ブロック等）が効く可能性が高い — 過去の `アプリ開発のやり取り` にも言及あり。

---

## 11. 不明点があるとき

- 仕様の解釈は **議事録・やり取り**を優先し、推測で仕様を固定しない。
- オーナー（小島氏）への確認が必要なビジネス判断は、コードに無理に埋め込まず TODO またはドキュメントに明示する。

---

以上。引き継ぎ後はこのファイルの **最終更新日** と **セクション 4 / 7** を都度更新すると、次の Agent が追いやすい。
