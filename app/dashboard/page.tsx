"use client";

import { useAuth } from "@/components/auth-provider";
import { DashboardClient } from "@/components/dashboard-client";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const key = loading ? "auth-loading" : (user?.uid ?? "signed-out");
  return <DashboardClient key={key} />;
}
