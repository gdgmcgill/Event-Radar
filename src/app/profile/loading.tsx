export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="h-48 bg-muted animate-pulse rounded-xl mb-6" />
      <div className="flex items-center gap-4 mb-8">
        <div className="h-20 w-20 rounded-full bg-muted animate-pulse" />
        <div className="space-y-2">
          <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    </div>
  );
}
