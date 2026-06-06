"use client";

import { useCallback, useRef, type ReactNode } from "react";
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

const WALL_COUNT = LOBBY_WALL_ORDER.length;
const WALL_ANGLE = 360 / WALL_COUNT;

export function wallIndexForTab(tab: DashboardTab): number {
  return LOBBY_WALL_ORDER.indexOf(tab);
}

type Props = {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  walls: Record<DashboardTab, ReactNode>;
};

/**
 * パラレルワールド「ロビー」の円形空間。
 * ユーザーは円形の部屋の中心に立ち、5枚の壁に囲まれている。
 * メニュー切替で「自分の視点」がぐるっと回り、正面の壁を向く（一人称・室内ビュー）。
 */
export function LobbyRoom({ activeTab, onTabChange, walls }: Props) {
  const activeIndex = wallIndexForTab(activeTab);
  // 部屋（壁の輪）を回して、向いている壁を正面に持ってくる。
  // 中心に立つユーザーから見ると「自分の視点が回って首を向ける」ように見える。
  const viewRotation = -activeIndex * WALL_ANGLE;
  const touchStartX = useRef<number | null>(null);

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
    <div className="lobby-room">
      <div className="lobby-room-ambient" aria-hidden />
      <div className="lobby-room-ceiling" aria-hidden />
      <div className="lobby-room-chandelier" aria-hidden />
      <div className="lobby-room-vignette" aria-hidden />

      <div
        className="lobby-room-scene"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
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
                className={`lobby-room-wall${isActive ? " lobby-room-wall--active" : ""}`}
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

      <div className="lobby-room-floor" aria-hidden />
    </div>
  );
}
