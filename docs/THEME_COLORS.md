# Lobby テーマカラー

最終更新: 2026-05-18

ホーム画面の **Lobby 番号カード**（角丸の枠）で使っている2色を、アプリ全体の基本テーマとする。

## 基本2色

| 名前 | CSS 変数 | Hex | 用途 |
|------|-----------|-----|------|
| **Lobby レッド**（赤系） | `--lobby-red` | `#b3001b` | 見出し・強調・CTA・番号・ナビのアクティブ色 |
| **Lobby クリーム**（アイボリー系） | `--lobby-cream` | `#fdf8f0` | カード背景・ボトムナビ・白だったパネル面 |

### 補助（既存）

| 名前 | CSS 変数 | Hex | 用途 |
|------|-----------|-----|------|
| レッド（ホバー） | `--lobby-red-hover` | `#8f0015` | ボタン hover |
| 画面下地 | `--lobby-screen-bg` | `#f4f4f5` | ダッシュボード全体の背景（クリームカードとのコントラスト用） |
| クリーム上の浮き面 | `--lobby-surface-raised` | `#fffaf3` | 番号カード内の「表示する」「スキャン」ボタンなど |

定義場所: `app/globals.css` の `:root`

## 使い方（実装）

```css
/* 例 */
background: var(--lobby-cream);
color: var(--lobby-red);
```

```tsx
/* Tailwind（任意値） */
className="bg-[var(--lobby-cream)] text-[var(--lobby-red)]"
```

新規 UI は **白 `#ffffff` をデフォルトにしない**。パネル・ナビ・カードは `--lobby-cream`、文字・線の強調は `--lobby-red` を優先する。

## デザインとの関係

Figma / PDF の色と違う場合でも、上記 Hex を正とする（`docs/DESIGN_IMPLEMENTATION_POLICY.md` 参照）。
