import { networkInterfaces } from "node:os";

const addrs = [];
for (const list of Object.values(networkInterfaces())) {
  if (!list) continue;
  for (const net of list) {
    if (net.family === "IPv4" && !net.internal) addrs.push(net.address);
  }
}

console.log("");
console.log("  PC では: http://localhost:3000");
if (addrs.length) {
  for (const ip of addrs) {
    console.log(`  スマホ（同じ Wi‑Fi）: http://${ip}:3000`);
  }
} else {
  console.log("  （LAN の IPv4 が見つかりませんでした。Wi‑Fi に接続してください）");
}
console.log("");
console.log("  ※ 先にこのターミナルでサーバーが起動したあと、上記 URL を開いてください。");
console.log("");
