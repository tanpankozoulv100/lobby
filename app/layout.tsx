import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import "./globals.css";

// モリサワ A1 ゴシック（ローカル woff2）。中間ウェイトは近いウェイトに丸める。
const a1Gothic = localFont({
  variable: "--font-a1",
  display: "swap",
  src: [
    { path: "./fonts/A1Gothic-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/A1Gothic-Bold.woff2", weight: "700", style: "normal" },
  ],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lobby",
  description: "Lobby — Next.js + Firebase",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lobby",
  },
  formatDetection: {
    telephone: false,
  },
};

/** スマホ表示・ノッチ周り（safe-area は CSS で利用） */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // ソフトキーボード表示時にレイアウトを縮めて入力欄がキーボードに隠れないように
  interactiveWidget: "resizes-content",
  themeColor: "#fafafa",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${a1Gothic.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
