"use client";

import { useEffect, useState } from "react";
import { ref, getDownloadURL } from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase";

export function useProfileMediaUrl(storagePath: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!storagePath) return;
    const storage = getFirebaseStorage();
    if (!storage) return;
    let cancelled = false;
    void getDownloadURL(ref(storage, storagePath))
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  return storagePath ? url : null;
}
