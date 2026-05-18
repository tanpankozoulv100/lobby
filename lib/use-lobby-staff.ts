"use client";

import { useEffect, useState } from "react";
import { isFirebaseConfigComplete } from "@/lib/firebase";
import { subscribeIsLobbyStaff } from "@/lib/lobby-staff";

/** ログイン中ユーザーの `admins/{uid}` 有無を購読する */
export function useLobbyStaff(uid: string | null | undefined): {
  isStaff: boolean;
  staffGateReady: boolean;
} {
  const [isStaff, setIsStaff] = useState(false);
  const [staffGateReady, setStaffGateReady] = useState(() => !uid);

  useEffect(() => {
    if (!uid) {
      setIsStaff(false);
      setStaffGateReady(true);
      return;
    }
    if (!isFirebaseConfigComplete()) {
      setIsStaff(false);
      setStaffGateReady(true);
      return;
    }

    setStaffGateReady(false);
    const unsub = subscribeIsLobbyStaff(
      uid,
      (staff) => {
        setIsStaff(staff);
        setStaffGateReady(true);
      },
      () => {
        setIsStaff(false);
        setStaffGateReady(true);
      }
    );
    return () => {
      unsub?.();
    };
  }, [uid]);

  return { isStaff, staffGateReady };
}
