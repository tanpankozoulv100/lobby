import type { Timestamp } from "firebase/firestore";

/** 本人確認（運営が Console で approved / rejected を設定） */
export type IdentityVerificationStatus = "none" | "pending" | "approved" | "rejected";

/** 通報しきい値超過などで Cloud Functions が設定（クライアントからは書けない） */
export type AccountStatus = "active" | "suspended";

/** `users/{uid}` に保存するフィールド（ルール・クライアントで共通イメージ用） */
export type UserProfileFields = {
  displayName: string;
  bio: string;
  /** 参加番号 0=運営、1〜=一般（001–999は3桁表示、1000〜は4桁表示。ダッシュボード初回開放時に採番） */
  participantNo?: number;
  /** ダッシュボード初回開放日時（採番の基準） */
  lobbyOpenedAt?: Timestamp;
  /** @deprecated 表示には使わない（後方互換の読み取りのみ） */
  participantSerial?: string;
  /** 本人確認の状態（未設定は none とみなす） */
  identityStatus?: IdentityVerificationStatus;
  /** Storage 上のパス（例: users/uid/identity/xxx.jpg） */
  idDocumentPath?: string;
  identitySubmittedAt?: Timestamp;
  /** シーズンチケット（シリアル）を引き換えた日時 */
  ticketRedeemedAt?: Timestamp;
  /** 正規化済みシリアル（監査・表示用） */
  seasonTicketCode?: string;
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

/** `users/{uid}/blockedUsers/{blockedUid}` */
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
