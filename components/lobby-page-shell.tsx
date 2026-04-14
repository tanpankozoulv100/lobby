import Image from "next/image";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export function LobbyPageShell({ children }: Props) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-[var(--lobby-screen-bg)] px-5 py-12">
      <main className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col items-center">
          <div className="relative h-16 w-44 shrink-0">
            <Image
              src="/assets/logo-lobby.png"
              alt="Lobby"
              fill
              className="object-contain object-center"
              priority
              sizes="176px"
            />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
