/**
 * 一定時間で解決しない Promise にだけフォールバック値を返す（UIが固まらないための保険）。
 * 元の Promise が「拒否（reject）」したときは握りつぶさず、そのまま reject を伝播させる
 * （呼び出し側で本来のエラーメッセージを出せるようにするため）。
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(fallback);
    }, ms);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
