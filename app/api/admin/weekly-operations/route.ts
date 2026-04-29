import { NextResponse } from "next/server";
import { runWeeklyCohortAndPublishAutomation } from "@/lib/server-weekly-operations";

export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const expected = process.env.LOBBY_WEEKLY_CRON_TOKEN;
  if (!expected) return false;
  const token = request.headers.get("x-lobby-cron-token") ?? "";
  return token.length > 0 && token === expected;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const targetSundayDateKey =
    body && typeof body === "object" && "targetSundayDateKey" in body
      ? String((body as { targetSundayDateKey?: unknown }).targetSundayDateKey ?? "")
      : undefined;

  try {
    const result = await runWeeklyCohortAndPublishAutomation({
      targetSundayDateKey: /^\d{8}$/.test(targetSundayDateKey ?? "") ? targetSundayDateKey : undefined,
    });
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ ok: false, error: "internal_error", message }, { status: 500 });
  }
}
