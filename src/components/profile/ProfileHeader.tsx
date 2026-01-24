"use client";

import Image from "next/image";

type ProfileHeaderProps = {
  name?: string | null;
  email?: string;
  avatarUrl?: string | null;
};

export default function ProfileHeader({ name, email, avatarUrl }: ProfileHeaderProps) {
  const initials = (name || email || "")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-6">
      {/* Avatar */}
      {avatarUrl ? (
        <div className="relative w-24 h-24 rounded-full overflow-hidden ring-4 ring-background shadow-xl">
          <Image
            src={avatarUrl}
            alt={name ?? "avatar"}
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-2xl font-semibold text-primary ring-4 ring-background shadow-xl">
          {initials || "U"}
        </div>
      )}

      {/* User Info */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          {name ?? email ?? "User"}
        </h1>
        {email && (
          <p className="text-sm text-muted-foreground">
            {email}
          </p>
        )}
      </div>
    </div>
  );
}