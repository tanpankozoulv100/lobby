"use client";

import { useProfileMediaUrl } from "@/lib/use-profile-media-url";

export function ProfileAvatarCircle({
  displayName,
  avatarPath,
  className = "h-10 w-10 text-sm",
}: {
  displayName: string;
  avatarPath?: string;
  className?: string;
}) {
  const avatarUrl = useProfileMediaUrl(avatarPath);
  const initial = displayName.trim().slice(0, 1) || "?";

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt="" className={`shrink-0 rounded-full object-cover ${className}`} />
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-zinc-300/90 font-semibold text-white ${className}`}
    >
      {initial}
    </span>
  );
}
