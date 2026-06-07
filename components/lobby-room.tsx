"use client";

import { type ReactNode } from "react";
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
export function LobbyRoom({ activeTab, walls }: Props) {
  return (
    <div className="lobby-room">
      <div className="lobby-room-ambient" aria-hidden />
      <div className="lobby-room-ceiling" aria-hidden />
      <div className="lobby-room-lightcone" aria-hidden />
      <div className="lobby-room-chandelier" aria-hidden />
      <div className="lobby-room-vignette" aria-hidden />

      <div className="lobby-room-scene">
        <div className="lobby-room-dolly">
          <div className="lobby-room-carousel">
            {LOBBY_WALL_ORDER.map((tabId) => {
              const isActive = tabId === activeTab;
              return (
                <section
                  key={tabId}
                  className={`lobby-room-wall lobby-room-wall--${WALL_FIXTURE[tabId]}${
                    isActive ? " lobby-room-wall--active" : ""
                  }`}
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
