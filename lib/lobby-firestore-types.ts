import type { Timestamp } from "firebase/firestore";
import type { CompatibilityAnswers } from "@/lib/compatibility-questions";

/** Shopify チケットの性別区分（ユーザー登録時に固定・変更不可） */
export type LobbyGender = "male" | "female";

/** 本人確認（運営が Console で approved / rejected を設定） */
export type IdentityVerificationStatus = "none" | "pending" | "approved" | "rejected";

/** 通報しきい値超過などで Cloud Functions が設定（クライアントからは書けない） */
export type AccountStatus = "active" | "suspended";

/** `users/{uid}` に保存するフィールド（ルール・クライアントで共通イメージ用） */
export type UserProfileFields = {
  displayName: string;
  bio: string;
  /** 登録時に固定（male / female）。チケット性別照合に使用 */
  gender?: LobbyGender;
  /** 登録時に固定（YYYYMMDD）。年齢表示用 */
  birthDate?: string;
  /** 居住都道府県（マイページから変更可） */
  prefecture?: string;
  /** 本名（登録時に固定。本人確認書類と照合） */
  legalName?: string;
  /** 参加番号 0=運営、1〜=一般（001–999は3桁表示、1000〜は4桁表示。ダッシュボード初回開放時に採番） */
  participantNo?: number;
  /** ダッシュボード初回開放日時（採番の基準） */
  lobbyOpenedAt?: Timestamp;
  /** @deprecated 表示には使わない（後方互換の読み取りのみ） */
  participantSerial?: string;
  /** Storage パス（例: users/uid/profile/avatar.jpg） */
  avatarPath?: string;
  /** Storage パス（例: users/uid/profile/cover.jpg） */
  coverPath?: string;
  /** 相性質問12問の回答（q1〜q12 → 選択肢 id） */
  compatibilityAnswers?: CompatibilityAnswers;
  /** 本人確認の状態（未設定は none とみなす） */
  identityStatus?: IdentityVerificationStatus;
  /** Storage 上のパス（例: users/uid/identity/xxx.jpg） */
  idDocumentPath?: string;
  identitySubmittedAt?: Timestamp;
  /** シーズンチケット（シリアル）を引き換えた日時 */
  ticketRedeemedAt?: Timestamp;
  /** 正規化済みシリアル（監査・表示用） */
  seasonTicketCode?: string;
  /** 参加中シーズン（`seasons/{id}`。チケット引き換え時に設定） */
  currentSeasonId?: string;
  /** 利用可否（通報3件で suspended — Cloud Functions が設定） */
  accountStatus?: AccountStatus;
  /** 自分に対する通報の累計（Functions が increment） */
  reportReceivedCount?: number;
  /** 通報ペアと同一コホートだった場合に Functions が true にし、表示上の A/B を反転 */
  cohortFlipActive?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

/** `ticketCodes/{normalizedCode}` — 運営が Console で作成し、ユーザーが初回のみ使用 */
export type TicketCodeFields = {
  usedBy: string | null;
  usedAt?: Timestamp;
  createdAt?: Timestamp;
  /** Shopify 購入区分（男性用 / 女性用チケット）。未設定の旧コードは照合スキップ */
  intendedGender?: LobbyGender;
  /** 紐づくシーズン（`seasons/{id}`）。同時期の複数開催・年複数回に対応 */
  seasonId?: string;
};

/** `seasons/{seasonId}` — 運営が管理サイトで CRUD。アプリは published のみ参照 */
export type SeasonStatus = "draft" | "published" | "archived";

export type SeasonFields = {
  /** 管理画面用の短い名前 */
  name: string;
  /** 開催地ラベル（例: 名古屋） */
  locationLabel: string;
  /** ホーム上部など */
  headerTitle: string;
  /** カード・履歴のメインタイトル */
  cardTitle: string;
  /** 表示用期間（例: 2026.04.17-05.18） */
  dateRangeLabel: string;
  startAt: Timestamp;
  endAt: Timestamp;
  /** A/B コホートハッシュ用（シーズンごとに一意） */
  cohortSeasonKey: string;
  /** シリアル接頭辞用（例: nagoya） */
  locationSlug: string;
  /** 開催年（例: 2026） */
  year: number;
  /** 開催回数（1=一回目） */
  round: number;
  /** シリアル引き換え済み人数（自動集計） */
  redeemedCount?: number;
  /** 発行済みシリアル数（自動集計） */
  issuedTicketCount?: number;
  status: SeasonStatus;
  /** チケット未紐づけ・旧ユーザーの表示フォールバック（1 件のみ推奨） */
  isLegacyDefault?: boolean;
  sortOrder?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

/** イベント日の朝 / 昼 / 夜（Firestore にもこの文字列で保存） */
export type EventSlotPeriod = "morning" | "afternoon" | "evening";

/** オフラインイベントのグループ（議事録の A/B） */
export type LobbyCohort = "A" | "B";

/**
 * `events/{eventId}/slotChoices/{slotId}` — 運営が Console で投入する行き先の選択肢
 * 同一 (dateKey, period, cohort) につき最大 2 件（lineIndex 0 / 1）想定
 */
export type EventSlotChoiceFields = {
  dateKey: string;
  /** 開始時刻（HH:mm） */
  startTime?: string;
  period: EventSlotPeriod;
  cohort: LobbyCohort;
  /** 0 または 1（同じ枠の2択用） */
  lineIndex: number;
  destinationLabel: string;
  eventDetail?: string;
  sortOrder?: number;
};

/**
 * `users/{uid}/eventSignups/{signupId}` — ユーザーが選んだ行き先（参加は任意）
 * signupId は `eventId__dateKey__period` 形式（lib で生成）
 */
export type EventSignupFields = {
  eventId: string;
  dateKey: string;
  period: EventSlotPeriod;
  slotChoiceId: string;
  cohortAtSignup?: LobbyCohort;
  destinationLabelAtSignup?: string;
  updatedAt?: Timestamp;
};

export type CohortWeekFields = {
  weekKey: string;
  weekStartDateKey: string;
  weekEndDateKey: string;
  cohort: LobbyCohort;
  generatedAt?: Timestamp;
};

export type EventDisplayWindowFields = {
  weekKey: string;
  visibleFromDateKey: string;
  visibleToDateKey: string;
  updatedAt?: Timestamp;
};

/**
 * `admins/{uid}` — 運営スタッフの Firebase Auth UID と同じドキュメント ID。
 * フィールドは不要（空ドキュメント可）。`/staff/events` からイベント投入する際に参照される。
 */

/**
 * `eventDestinations/{id}` — 運営が管理サイトで登録する集合場所マスタ（スプシ EventMasterList 相当）。
 * 書き込みは Admin SDK のみ。アプリ参加者は参照しない。
 */
export type EventDestinationFields = {
  label: string;
  sortOrder: number;
  createdAt?: Timestamp;
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

/** `users/{uid}/dateInviteTickets/{ticketId}` */
export type DateInviteTicketFields = {
  milestoneMatches: number;
  grantedAt?: Timestamp;
  expiresAt: Timestamp;
  consumedAt?: Timestamp;
  consumedByInviteId?: string;
};

/** `users/{uid}/dateInvites/{inviteId}` */
export type DateInviteFields = {
  toUid: string;
  location: string;
  proposedAt: Timestamp;
  message?: string;
  ticketId: string;
  createdAt?: Timestamp;
};

/** 通報理由（`userReports` の reasonCode） */
export type UserReportReasonCode = "harassment" | "spam" | "inappropriate" | "other";

/** `userReports/{reportId}` — ユーザーからの通報（運営は別サイトで Admin SDK 参照想定） */
export type UserReportFields = {
  reporterUid: string;
  reportedUid: string;
  reasonCode: UserReportReasonCode;
  note: string;
  createdAt?: Timestamp;
};

/** `users/{uid}/blockedUsers/{blockedUid}` — レガシー用（ユーザーアプリからは新規作成しない） */
export type BlockedUserFields = {
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
