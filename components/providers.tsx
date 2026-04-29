"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth-provider";
import { DevBypassBanner } from "@/components/dev-bypass-banner";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DevBypassBanner />
      {children}
    </AuthProvider>
  );
}
