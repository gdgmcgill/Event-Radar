interface BanStatus {
  banned_at: string | null;
  ban_expires_at: string | null;
}

export function isBanned(user: BanStatus): boolean {
  if (!user.banned_at) return false;
  if (!user.ban_expires_at) return true; // permanent
  const expiresAt = Date.parse(user.ban_expires_at);
  // DI-76: corrupted expiry data must not turn an active ban into admission.
  return !Number.isFinite(expiresAt) || expiresAt > Date.now();
}
