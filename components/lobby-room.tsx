"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { DashboardTab } from "@/components/dashboard-bottom-nav";

/** ボトムナビ左→右の順（円形の壁もこの順で並ぶ） */
export const LOBBY_WALL_ORDER: DashboardTab[] = ["history", "event", "home", "chat", "mypage"];

const WALL_LABELS: Record<DashboardTab, string> = {
  history: "マッチング履歴",
  event: "イベント",
  home: "ロビー",
  chat: "レター",
  mypage: "マイページ",
};

/** 壁ごとの設置物テーマ（額縁・什器の見た目を出し分ける） */
const WALL_FIXTURE: Record<DashboardTab, string> = {
  history: "keys",
  event: "calendar",
  home: "hearth",
  chat: "desk",
  mypage: "mirror",
};

const WALL_COUNT = LOBBY_WALL_ORDER.length;
const WALL_ANGLE = 360 / WALL_COUNT;

/** 視点が回り切る時間（CSS のトランジション/アニメーションと合わせる） */
const TURN_MS = 1100;

export function wallIndexForTab(tab: DashboardTab): number {
  return LOBBY_WALL_ORDER.indexOf(tab);
}

type Props = {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  walls: Record<DashboardTab, ReactNode>;
};

/**
 * パラレルワールド「ロビー」の円形空間（一人称・室内ビュー）。
 * ユーザーは洋館の円形の広間の中心に立ち、5枚の壁に囲まれている。
 * メニュー切替で「一歩下がって → 視点が回頭して → 目的の壁へ一歩近づく」ことで
 * 空間を広く使いながら正面の壁（＝壁に設置されたメニュー）を向く。
 */
export function LobbyRoom({ activeTab, onTabChange, walls }: Props) {
  const activeIndex = wallIndexForTab(activeTab);
  // 部屋（壁の輪）を回して、向いている壁を正面に持ってくる。
  // 中心に立つユーザーから見ると「自分の視点が回って首を向ける」ように見える。
  const viewRotation = -activeIndex * WALL_ANGLE;
  const touchStartX = useRef<number | null>(null);

  // 視点が回頭している最中だけ true（このときだけ左右の壁を見せる）
  const [isTurning, setIsTurning] = useState(false);
  const dollyRef = useRef<HTMLDivElement>(null);
  const isFirst = useRef(true);

  useEffect(() => {
    // 初回マウントではドリー演出を再生しない
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    // 「一歩引いて前へ」のドリーアニメーションを毎回頭から再生
    const el = dollyRef.current;
    if (el) {
      el.classList.remove("is-dollying");
      // 強制リフロー（アニメーションを確実に再スタートさせる）
      void el.offsetWidth;
      el.classList.add("is-dollying");
    }
    setIsTurning(true);
    const t = window.setTimeout(() => setIsTurning(false), TURN_MS);
    return () => window.clearTimeout(t);
  }, [activeTab]);

  const goAdjacent = useCallback(
    (delta: -1 | 1) => {
      const next = (activeIndex + delta + WALL_COUNT) % WALL_COUNT;
      onTabChange(LOBBY_WALL_ORDER[next]!);
    },
    [activeIndex, onTabChange]
  );

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX;
    if (end == null) return;
    const dx = end - start;
    if (Math.abs(dx) < 48) return;
    goAdjacent(dx < 0 ? 1 : -1);
  };

  return (
    <div className={`lobby-room${isTurning ? " lobby-room--turning" : ""}`}>
      <div className="lobby-room-ambient" aria-hidden />
      <div className="lobby-room-ceiling" aria-hidden />
      <div className="lobby-room-lightcone" aria-hidden />
      <div className="lobby-room-chandelier" aria-hidden />
      <div className="lobby-room-vignette" aria-hidden />

      <div
        className="lobby-room-scene"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="lobby-room-dolly" ref={dollyRef}>
          <div
            className="lobby-room-carousel"
            style={{
              transform: `translateZ(var(--lobby-room-radius)) rotateY(${viewRotation}deg)`,
            }}
          >
            {LOBBY_WALL_ORDER.map((tabId, i) => {
              const isActive = tabId === activeTab;
              return (
                <section
                  key={tabId}
                  className={`lobby-room-wall lobby-room-wall--${WALL_FIXTURE[tabId]}${
                    isActive ? " lobby-room-wall--active" : ""
                  }`}
                  style={{
                    transform: `rotateY(${i * WALL_ANGLE}deg) translateZ(calc(var(--lobby-room-radius) * -1))`,
                  }}
                  aria-hidden={!isActive}
                >
                  <div className="lobby-room-wall-frame">
                    <p className="lobby-room-wall-label">{WALL_LABELS[tabId]}</p>
                    <div className="lobby-room-niche">
                      <div className="lobby-room-niche-scroll">{walls[tabId]}</div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>

      <div className="lobby-room-floor" aria-hidden />
    </div>
  );
}
