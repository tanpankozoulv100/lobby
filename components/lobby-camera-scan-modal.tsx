"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  extractPeerCodeFromQrOrInput,
  registerLinkByPeerCode,
} from "@/lib/firestore-connections";
import { withTimeout } from "@/lib/promise-timeout";

type Props = {
  open: boolean;
  onClose: () => void;
  uid: string;
  onRequestCodeInput: () => void;
  onMatched?: (result: { rematched: boolean }) => void;
  /** 運営スタッフは再マッチの24時間制限をスキップ（動作確認用） */
  bypassCooldown?: boolean;
};

export function LobbyCameraScanModal({
  open,
  onClose,
  uid,
  onRequestCodeInput,
  onMatched,
  bypassCooldown,
}: Props) {
  const readerIdRef = useRef(`lobby-qr-reader-${Math.random().toString(36).slice(2, 11)}`);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      /* 停止済み */
    }
  }, []);

  const handleDecoded = useCallback(
    async (raw: string) => {
      if (busy || handledRef.current) return;
      const code = extractPeerCodeFromQrOrInput(raw);
      if (!code) {
        setMessage("QRの内容を読み取れませんでした。");
        return;
      }
      handledRef.current = true;
      setBusy(true);
      setMessage(null);
      setSuccess(null);
      let result: Awaited<ReturnType<typeof registerLinkByPeerCode>>;
      try {
        result = await withTimeout(registerLinkByPeerCode(uid, code, { bypassCooldown }), 15000, {
          ok: false,
          message: "通信に時間がかかっています。電波状況を確認して、もう一度お試しください。",
        });
      } catch {
        result = { ok: false, message: "マッチングに失敗しました。通信環境を確認して、もう一度お試しください。" };
      } finally {
        setBusy(false);
      }
      if (result.ok) {
        await stopScanner();
        onMatched?.({ rematched: result.rematched === true });
        setSuccess(
          result.rematched
            ? "再マッチしました。レターの送信期限が更新されます。"
            : "マッチングしました。"
        );
        window.setTimeout(() => {
          setSuccess(null);
          onClose();
        }, 1100);
        return;
      }
      handledRef.current = false;
      setMessage(result.message);
    },
    [uid, busy, onClose, onMatched, stopScanner, bypassCooldown]
  );

  useEffect(() => {
    if (!open) {
      handledRef.current = false;
      setMessage(null);
      setSuccess(null);
      setBusy(false);
      void stopScanner();
      return;
    }

    let cancelled = false;
    const readerId = readerIdRef.current;
    const scanner = new Html5Qrcode(readerId);
    scannerRef.current = scanner;

    void (async () => {
      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const size = Math.min(viewfinderWidth, viewfinderHeight) * 0.72;
              return { width: size, height: size };
            },
          },
          (text) => {
            if (!cancelled) void handleDecoded(text);
          },
          () => {}
        );
      } catch {
        if (!cancelled) {
          setMessage(
            "カメラを起動できません。ブラウザのカメラ許可を確認するか、コード入力をお試しください。"
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [open, handleDecoded, stopScanner]);

  const goToCodeInput = useCallback(() => {
    void stopScanner().then(() => {
      onRequestCodeInput();
    });
  }, [onRequestCodeInput, stopScanner]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      role="dialog"
      aria-modal="true"
      aria-label="QRコードをスキャン"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => {
            void stopScanner().then(onClose);
          }}
          className="rounded-lg px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10"
        >
          閉じる
        </button>
        <p className="text-sm font-medium text-white">QRスキャン</p>
        <span className="w-14" aria-hidden />
      </div>

      <div className="relative min-h-0 flex-1">
        <div id={readerIdRef.current} className="h-full w-full [&_video]:object-cover" />
        {busy ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
            <p className="rounded-lg bg-black/70 px-4 py-2 text-sm text-white">マッチング中…</p>
          </div>
        ) : null}
        {success ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55 px-6">
            <p className="rounded-xl bg-emerald-500/95 px-4 py-3 text-center text-sm font-medium text-white shadow-lg">
              {success}
            </p>
          </div>
        ) : null}
      </div>

      {message ? (
        <p className="mx-4 mb-2 rounded-lg bg-amber-500/90 px-3 py-2 text-center text-sm text-white">
          {message}
        </p>
      ) : null}

      <div className="border-t border-white/10 px-4 py-4">
        <button
          type="button"
          onClick={goToCodeInput}
          className="w-full rounded-xl border border-white/30 bg-white/10 py-3.5 text-sm font-medium text-white backdrop-blur-sm"
        >
          コードを入力してマッチング
        </button>
      </div>
    </div>
  );
}
