"use client";

type Props = {
  onSignOut: () => void;
};

export function DashboardSuspendedScreen({ onSignOut }: Props) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h1 className="font-serif text-lg font-semibold text-zinc-900 dark:text-zinc-50">アカウントの利用を停止しています</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          通報の審査の結果、Lobby の利用を一時停止しました。ご不明点は運営までお問い合わせください。
        </p>
        <button
          type="button"
          onClick={() => onSignOut()}
          className="mt-6 w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}
