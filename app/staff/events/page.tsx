import type { Metadata } from "next";
import { StaffEventsClient } from "@/components/staff-events-client";

export const metadata: Metadata = {
  title: "イベント運営 | Lobby",
  robots: "noindex, nofollow",
};

export default function StaffEventsPage() {
  return (
    <div className="min-h-dvh bg-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <StaffEventsClient />
      </div>
    </div>
  );
}
