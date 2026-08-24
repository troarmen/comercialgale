import { VitrineEsqueleto } from "@/components/catalogo/vitrine";

export default function CarregandoProdutos() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 h-4 w-40 animate-pulse rounded bg-borda" aria-hidden="true" />
      <div className="mb-6 h-8 w-72 animate-pulse rounded bg-borda" aria-hidden="true" />
      <VitrineEsqueleto />
      <p className="sr-only" role="status">
        Carregando produtos…
      </p>
    </div>
  );
}
