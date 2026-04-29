import { networkInterfaces } from "node:os";

const addrs = [];
try {
  for (const list of Object.values(networkInterfaces())) {
    if (!list) continue;
    for (const net of list) {
      if (net.family === "IPv4" && !net.internal) addrs.push(net.address);
    }
  }
} catch {
  /* OS / サンドボックス等で networkInterfaces が失敗しても dev は続行する */
}

const defaultPort = process.env.PORT || "3000";

console.log("");
console.log("  ▼ 開く URL は、このあと Next.js が出す「Local:」の行を正としてください。");
console.log("    （ポート 3000 が埋まっていると 3001 などに自動変更されます）");
console.log("");
console.log(`  参考（デフォルト想定） PC: http://localhost:${defaultPort}`);
if (addrs.length) {
  for (const ip of addrs) {
    console.log(`  参考（デフォルト想定）スマホ: http://${ip}:${defaultPort}`);
  }
} else {
  console.log("  （LAN の IPv4 が見つかりませんでした。Wi‑Fi に接続してください）");
}
console.log("");
console.log("  ※ 先にこのターミナルで「✓ Ready」が出てから URL を開いてください。");
console.log("");
