import type { Timestamp } from "firebase/firestore";

/** `users/{uid}` に保存するフィールド（ルール・クライアントで共通イメージ用） */
export type UserProfileFields = {
  displayName: string;
  bio: string;
  /** 参加番号 1–999（ホーム中央の No.） */
  participantNo?: number;
  /** 例: @20260329-007 */
  participantSerial?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

/** `events/{eventId}` — クライアントは isPublished === true のみクエリ */
export type EventFields = {
  title: string;
  description?: string;
  startsAt: Timestamp;
  endsAt?: Timestamp;
  locationSummary?: string;
  isPublished: boolean;
  createdAt?: Timestamp;
};

/** `announcements/{id}` — 運営向けお知らせ（公開分のみ一覧） */
export type AnnouncementFields = {
  title: string;
  body?: string;
  isPublished: boolean;
  /** 一覧の並び順に使用（公開日時） */
  publishedAt: Timestamp;
  createdAt?: Timestamp;
};
