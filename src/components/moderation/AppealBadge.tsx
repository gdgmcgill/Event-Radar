interface AppealBadgeProps {
  appealCount: number;
}

export function AppealBadge({ appealCount }: AppealBadgeProps) {
  if (appealCount <= 0) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
      Appeal{appealCount > 1 ? ` #${appealCount}` : ""}
    </span>
  );
}
