/** Skeleton do funil: mantém o layout estável enquanto o board carrega. */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl animate-pulse flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-40 rounded bg-muted" />
          <div className="h-4 w-72 rounded bg-muted" />
        </div>
        <div className="h-10 w-36 rounded-lg bg-muted" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="h-4 w-64 rounded bg-muted" />
        <div className="h-8 w-32 rounded-lg bg-muted" />
      </div>

      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, column) => (
          <div
            key={column}
            className="flex w-72 shrink-0 flex-col gap-2 rounded-xl border border-border bg-muted/30 p-2"
          >
            <div className="flex items-center justify-between px-1 py-1">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-5 w-8 rounded-full bg-muted" />
            </div>
            {Array.from({ length: 3 }).map((__, card) => (
              <div key={card} className="flex flex-col gap-2 rounded-lg bg-background p-3">
                <div className="h-4 w-40 rounded bg-muted" />
                <div className="h-3 w-32 rounded bg-muted" />
                <div className="h-4 w-20 rounded bg-muted" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
