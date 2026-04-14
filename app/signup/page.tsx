import Link from "next/link";
import { SignupForm } from "@/components/signup-form";
import { LobbyPageShell } from "@/components/lobby-page-shell";

export default function SignupPage() {
  return (
    <LobbyPageShell>
      <div className="w-full space-y-6">
        <div>
          <Link
            href="/"
            className="text-sm text-zinc-500 underline-offset-2 hover:text-[var(--lobby-red)] hover:underline"
          >
            ← トップへ
          </Link>
          <h1 className="mt-4 font-serif text-2xl font-semibold tracking-tight text-zinc-900">新規登録</h1>
          <p className="mt-1 text-sm text-zinc-600">メールアドレスとパスワードでアカウントを作成します。</p>
        </div>
        <SignupForm />
      </div>
    </LobbyPageShell>
  );
}
