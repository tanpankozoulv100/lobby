import { NextResponse } from "next/server";
import { createEventFromExternalIntake, validateExternalEventInput } from "@/lib/server-event-intake";

export const runtime = "nodejs";

function hasValidIntakeToken(request: Request): boolean {
  const expected = process.env.LOBBY_EVENT_INTAKE_TOKEN;
  if (!expected) return false;
  const token = request.headers.get("x-lobby-intake-token") ?? "";
  return token.length > 0 && token === expected;
}

export async function POST(request: Request) {
  if (!hasValidIntakeToken(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = validateExternalEventInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: "bad_request", message: parsed.message }, { status: 400 });
  }

  try {
    const eventId = await createEventFromExternalIntake(parsed.value);
    return NextResponse.json({ ok: true, eventId }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ ok: false, error: "internal_error", message }, { status: 500 });
  }
}
