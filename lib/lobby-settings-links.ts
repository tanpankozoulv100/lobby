/** 各種設定シートのリンク（URL は .env / Vercel env で上書き可） */

export type LobbySettingsLinkItem = {
  id: string;
  label: string;
  href: string | undefined;
  /** href が無いときの案内文 */
  fallbackMessage?: string;
};

/** Vercel 未設定時の本番フォールバック（laughgaki-store の公開ページ） */
export const LOBBY_SETTINGS_URL_DEFAULTS: Record<string, string> = {
  NEXT_PUBLIC_LOBBY_TERMS_URL:
    "https://laughgaki-store.com/pages/lobby-%E5%88%A9%E7%94%A8%E8%A6%8F%E7%B4%84",
  NEXT_PUBLIC_LOBBY_PRIVACY_URL:
    "https://laughgaki-store.com/pages/%E3%83%97%E3%83%A9%E3%82%A4%E3%83%90%E3%82%B7%E3%83%BC%E3%83%9D%E3%83%AA%E3%82%B7%E3%83%BC-lobby",
  NEXT_PUBLIC_LOBBY_CANCELLATION_POLICY_URL:
    "https://laughgaki-store.com/pages/lobby%E3%82%AD%E3%83%A3%E3%83%B3%E3%82%BB%E3%83%AB%E3%83%9D%E3%83%AA%E3%82%B7%E3%83%BC",
  NEXT_PUBLIC_LOBBY_COMMERCIAL_TRANSACTIONS_URL:
    "https://laughgaki-store.com/pages/%E7%89%B9%E5%AE%9A%E5%95%86%E5%8F%96%E5%BC%95%E6%B3%95%E3%81%AB%E5%9F%BA%E3%81%A5%E3%81%8F%E8%A1%A8%E8%A8%98",
};

export const LOBBY_SETTINGS_PUBLIC_URL_KEYS = [
  "NEXT_PUBLIC_LOBBY_NOTIFICATION_SETTINGS_URL",
  "NEXT_PUBLIC_LOBBY_COMPANY_URL",
  "NEXT_PUBLIC_LOBBY_TERMS_URL",
  "NEXT_PUBLIC_LOBBY_SERVICE_DESCRIPTION_URL",
  "NEXT_PUBLIC_LOBBY_PRIVACY_URL",
  "NEXT_PUBLIC_LOBBY_CANCELLATION_POLICY_URL",
  "NEXT_PUBLIC_LOBBY_PERSONAL_INFO_URL",
  "NEXT_PUBLIC_LOBBY_COMMERCIAL_TRANSACTIONS_URL",
  "NEXT_PUBLIC_LOBBY_SAFETY_GUIDE_URL",
] as const;

function envUrl(key: (typeof LOBBY_SETTINGS_PUBLIC_URL_KEYS)[number]): string | undefined {
  const v = (process.env[key] ?? LOBBY_SETTINGS_URL_DEFAULTS[key] ?? "").trim();
  return v || undefined;
}

export const LOBBY_SETTINGS_LINKS: LobbySettingsLinkItem[] = [
  {
    id: "notifications",
    label: "通知設定",
    href: envUrl("NEXT_PUBLIC_LOBBY_NOTIFICATION_SETTINGS_URL"),
    fallbackMessage:
      "お知らせはホームのベルから確認できます。レターの通知は、各レターの設定から相手ごとにオン・オフできます。端末の通知許可は、スマホの設定アプリから変更してください。",
  },
  {
    id: "company",
    label: "会社概要",
    href: envUrl("NEXT_PUBLIC_LOBBY_COMPANY_URL"),
    fallbackMessage: "準備中です。運営からお知らせするまでお待ちください。",
  },
  {
    id: "terms",
    label: "利用規約",
    href: envUrl("NEXT_PUBLIC_LOBBY_TERMS_URL"),
    fallbackMessage: "準備中です。運営からお知らせするまでお待ちください。",
  },
  {
    id: "service",
    label: "サービス説明",
    href: envUrl("NEXT_PUBLIC_LOBBY_SERVICE_DESCRIPTION_URL"),
    fallbackMessage: "準備中です。運営からお知らせするまでお待ちください。",
  },
  {
    id: "privacy",
    label: "プライバシーポリシー",
    href: envUrl("NEXT_PUBLIC_LOBBY_PRIVACY_URL"),
    fallbackMessage: "準備中です。運営からお知らせするまでお待ちください。",
  },
  {
    id: "cancellation",
    label: "キャンセルポリシー",
    href: envUrl("NEXT_PUBLIC_LOBBY_CANCELLATION_POLICY_URL"),
    fallbackMessage: "準備中です。運営からお知らせするまでお待ちください。",
  },
  {
    id: "personal-info",
    label: "個人情報等の利用について",
    href: envUrl("NEXT_PUBLIC_LOBBY_PERSONAL_INFO_URL"),
    fallbackMessage: "準備中です。運営からお知らせするまでお待ちください。",
  },
  {
    id: "commercial",
    label: "特定商取引法に基づく表記",
    href: envUrl("NEXT_PUBLIC_LOBBY_COMMERCIAL_TRANSACTIONS_URL"),
    fallbackMessage: "準備中です。運営からお知らせするまでお待ちください。",
  },
  {
    id: "safety",
    label: "安心安全ガイド",
    href: envUrl("NEXT_PUBLIC_LOBBY_SAFETY_GUIDE_URL"),
    fallbackMessage: "準備中です。運営からお知らせするまでお待ちください。",
  },
];
