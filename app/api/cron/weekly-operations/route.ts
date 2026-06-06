import { NextResponse } from "next/server";
import { runWeeklyCohortAndPublishAutomation } from "@/lib/server-weekly-operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel Cron 用エンドポイント（毎週木曜）。
 * Vercel Cron は CRON_SECRET を設定すると `Authorization: Bearer <CRON_SECRET>` を自動付与する。
 * 次週（日〜土）の eventDisplayWindow/current を公開し、対象ユーザーの cohortWeeks を更新する。
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runWeeklyCohortAndPublishAutomation();
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ ok: false, error: "internal_error", message }, { status: 500 });
  }
}
