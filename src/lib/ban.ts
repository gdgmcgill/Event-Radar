interface BanStatus {
  banned_at: string | null;
  ban_expires_at: string | null;
}

export function isBanned(user: BanStatus): boolean {
  if (!user.banned_at) return false;
  if (!user.ban_expires_at) return true; // permanent
  return new Date(user.ban_expires_at) > new Date();
}
