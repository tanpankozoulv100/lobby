import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import * as functions from "firebase-functions/v1";
import { getLobbyCohortForSeason } from "./cohort";

initializeApp();

/** `userReports` がこの件数に達した被通報ユーザーを suspended にする（仕様: 3） */
const REPORT_SUSPEND_THRESHOLD = 3;

/** Firestore 第1世代トリガー（Gen2/Eventarc の初回 IAM 伝播で失敗しやすいため v1 を使用） */
export const onUserReportCreated = functions
  .region("asia-northeast1")
  .firestore.document("userReports/{reportId}")
  .onCreate(async (snap, context) => {
    const reporterUid = snap.get("reporterUid");
    const reportedUid = snap.get("reportedUid");
    if (typeof reporterUid !== "string" || typeof reportedUid !== "string") {
      logger.warn("onUserReportCreated: missing uids", { reportId: context.params.reportId });
      return;
    }
    if (reporterUid === reportedUid) return;

    const db = getFirestore();

    const cohortReporter = getLobbyCohortForSeason(reporterUid);
    const cohortReported = getLobbyCohortForSeason(reportedUid);

    try {
      await db.runTransaction(async (tx) => {
        const userRef = db.collection("users").doc(reportedUid);
        const userSnap = await tx.get(userRef);
        const prevCount =
          userSnap.exists && typeof userSnap.data()?.reportReceivedCount === "number"
            ? (userSnap.data()?.reportReceivedCount as number)
            : 0;
        const nextCount = prevCount + 1;

        const patch: Record<string, unknown> = {
          reportReceivedCount: nextCount,
          updatedAt: FieldValue.serverTimestamp(),
        };

        if (cohortReporter === cohortReported) {
          patch.cohortFlipActive = true;
        }

        if (nextCount >= REPORT_SUSPEND_THRESHOLD) {
          patch.accountStatus = "suspended";
          patch.suspendedAt = FieldValue.serverTimestamp();
          patch.suspendReason = "reports_threshold";
        }

        tx.set(userRef, patch, { merge: true });
      });
    } catch (e) {
      logger.error("onUserReportCreated transaction failed", e);
    }
  });
