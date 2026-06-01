"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeUserProfile } from "@/lib/firestore-users";
import {
  fetchLegacyDefaultSeasonDisplay,
  subscribeSeason,
} from "@/lib/firestore-seasons";
import {
  fallbackSeasonDisplay,
  seasonFieldsToDisplay,
  type SeasonDisplay,
} from "@/lib/season-display";
import type { SeasonFields } from "@/lib/lobby-firestore-types";

export function useUserSeason(uid: string | undefined): {
  season: SeasonDisplay;
  loading: boolean;
} {
  const [resolved, setResolved] = useState<SeasonDisplay | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setResolved(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let unsubSeason: (() => void) | null = null;

    const applyFields = (seasonId: string, fields: SeasonFields | null) => {
      if (cancelled) return;
      if (fields && fields.status === "published") {
        setResolved(seasonFieldsToDisplay(seasonId, fields));
      } else {
        void fetchLegacyDefaultSeasonDisplay().then((legacy) => {
          if (!cancelled) setResolved(legacy);
        });
      }
      setLoading(false);
    };

    const unsubProfile = subscribeUserProfile(
      uid,
      (profile) => {
        unsubSeason?.();
        unsubSeason = null;
        const seasonId = profile?.currentSeasonId;
        if (seasonId) {
          unsubSeason = subscribeSeason(seasonId, (fields) => applyFields(seasonId, fields));
        } else if (profile?.ticketRedeemedAt != null) {
          void fetchLegacyDefaultSeasonDisplay().then((legacy) => {
            if (!cancelled) {
              setResolved(legacy);
              setLoading(false);
            }
          });
        } else {
          setResolved(null);
          setLoading(false);
        }
      },
      () => {
        if (!cancelled) {
          setResolved(null);
          setLoading(false);
        }
      }
    );

    return () => {
      cancelled = true;
      unsubProfile?.();
      unsubSeason?.();
    };
  }, [uid]);

  const season = useMemo(
    () => resolved ?? fallbackSeasonDisplay(),
    [resolved]
  );

  return { season, loading };
}
