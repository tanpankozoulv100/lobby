/**
 * 開発サーバー起動前に、指定ポートを掴んでいるプロセスを終了する（macOS / Linux）。
 * 前回の `npm run dev` が残っていると 3001 に逃げるのを防ぐ。
 */
import { execSync } from "node:child_process";

const port = process.argv[2] ?? process.env.PORT ?? "3000";

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

try {
  const raw = execSync(`lsof -ti tcp:${port}`, { encoding: "utf8" }).trim();
  if (!raw) process.exit(0);

  const pids = [...new Set(raw.split("\n").filter(Boolean))];
  for (const pid of pids) {
    console.log(`[dev] ポート ${port} を使用中のプロセス (PID ${pid}) を終了します`);
    try {
      process.kill(Number(pid), "SIGTERM");
    } catch {
      /* 既に終了 */
    }
  }
  sleepMs(400);
} catch {
  /* lsof が 1 を返す = ポート空き */
}
