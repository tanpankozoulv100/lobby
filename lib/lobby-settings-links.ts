/** 各種設定シートのリンク（URL は .env で上書き可） */

export type LobbySettingsLinkItem = {
  id: string;
  label: string;
  href: string | undefined;
  /** href が無いときの案内文 */
  fallbackMessage?: string;
};

function envUrl(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

export const LOBBY_SETTINGS_LINKS: LobbySettingsLinkItem[] = [
  {
    id: "notifications",
    label: "通知設定",
    href: envUrl("NEXT_PUBLIC_LOBBY_NOTIFICATION_SETTINGS_URL"),
    fallbackMessage:
      "お知らせはホームのベルから確認できます。チャットの通知は、各トークの設定から相手ごとにオン・オフできます。端末の通知許可は、スマホの設定アプリから変更してください。",
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
