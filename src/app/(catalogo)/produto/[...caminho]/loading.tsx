export default function CarregandoProduto() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 h-4 w-64 animate-pulse rounded bg-borda" aria-hidden="true" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]" aria-hidden="true">
        <div className="aspect-[3/4] animate-pulse rounded-2xl bg-borda/60" />
        <div className="space-y-4">
          <div className="h-3 w-24 animate-pulse rounded bg-borda" />
          <div className="h-8 w-3/4 animate-pulse rounded bg-borda" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-borda" />
          <div className="h-64 animate-pulse rounded-2xl bg-borda/60" />
        </div>
      </div>
      <p className="sr-only" role="status">
        Carregando produto…
      </p>
    </div>
  );
}
