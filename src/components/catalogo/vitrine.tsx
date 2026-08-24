import Link from "next/link";
import { Suspense } from "react";
import {
  listarProdutos,
  marcasComContagem,
  precosPorProduto,
  type FiltrosListagem,
} from "@/lib/catalogo";
import { numero } from "@/lib/formato";
import { dadosListaProdutos, JsonLd } from "@/lib/seo";
import { CartaoProduto, GradeProdutos } from "./cartao-produto";
import { FiltrosVitrine } from "./filtros-vitrine";
import { PaginacaoLinks } from "./paginacao-links";

/**
 * Miolo compartilhado das páginas de listagem: barra de refino, grade,
 * estado vazio e paginação. Cada página cuida do próprio H1, trilha e SEO.
 */
export async function Vitrine({
  filtros,
  caminho,
  parametros,
  comBusca = false,
  semFiltroDeMarca = false,
}: {
  filtros: FiltrosListagem;
  /** rota base para os links de paginação */
  caminho: string;
  /** filtros vigentes que a paginação deve preservar */
  parametros?: Record<string, string | undefined>;
  comBusca?: boolean;
  /** a página de marca já É o filtro de marca — não ofereça de novo */
  semFiltroDeMarca?: boolean;
}) {
  const [{ produtos, total, pagina, paginas }, marcas] = await Promise.all([
    listarProdutos(filtros),
    marcasComContagem(),
  ]);
  const precos = await precosPorProduto(produtos.map((p) => p.id));

  // Só oferece as marcas que existem no recorte atual? A contagem por recorte
  // custaria outra consulta; a lista completa já ajuda e nunca mente — filtro
  // sem resultado cai no estado vazio com saída clara.
  const opcoesMarca = semFiltroDeMarca
    ? []
    : marcas.map((m) => ({ id: m.id, nome: m.nome }));

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-suave" aria-live="polite">
          {numero(total)} {total === 1 ? "produto" : "produtos"}
        </p>
        <Suspense fallback={<div className="h-10" />}>
          <FiltrosVitrine marcas={opcoesMarca} comBusca={comBusca} />
        </Suspense>
      </div>

      {produtos.length === 0 ? (
        <div className="rounded-2xl border border-borda/60 bg-superficie px-6 py-20 text-center shadow-pousada">
          <p className="text-base font-semibold text-texto">
            Nenhum produto por aqui
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-suave">
            {filtros.busca
              ? `Não encontramos nada para “${filtros.busca}”. Confira a grafia ou tente um termo mais curto — “sutiã”, “meia social”, “boxer”…`
              : "Nenhum produto com esses filtros no momento. Limpe o refino ou navegue pelas categorias."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/produtos"
              className="flex h-10 items-center rounded-full bg-acento px-5 text-sm font-semibold text-white transition hover:bg-acento-forte"
            >
              Ver todo o catálogo
            </Link>
            <Link
              href="/lancamentos"
              className="text-sm font-semibold text-acento-texto transition hover:text-acento-forte"
            >
              Ver lançamentos
            </Link>
          </div>
        </div>
      ) : (
        <>
          <JsonLd
            dados={dadosListaProdutos(
              produtos.map((p) => ({ nome: p.titulo, slug: p.slug })),
              caminho,
            )}
          />
          <GradeProdutos>
            {produtos.map((p, i) => (
              <CartaoProduto
                key={p.id}
                produto={p}
                faixa={precos.get(p.id)}
                prioridade={pagina === 1 && i < 4}
              />
            ))}
          </GradeProdutos>
          <PaginacaoLinks
            pagina={pagina}
            paginas={paginas}
            total={total}
            caminho={caminho}
            parametros={parametros}
          />
        </>
      )}
    </>
  );
}

/** Esqueleto da vitrine para o loading.tsx das páginas de listagem. */
export function VitrineEsqueleto() {
  return (
    <div aria-hidden="true">
      <div className="mb-5 flex items-center justify-between">
        <div className="h-4 w-28 animate-pulse rounded bg-borda" />
        <div className="h-10 w-64 animate-pulse rounded-lg bg-borda" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-borda bg-superficie">
            <div className="aspect-[3/4] animate-pulse bg-borda/60" />
            <div className="space-y-2 p-4">
              <div className="h-3 w-16 animate-pulse rounded bg-borda" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-borda" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-borda" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
