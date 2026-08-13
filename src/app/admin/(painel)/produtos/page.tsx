import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FiltrosProdutos } from "@/components/filtros-produtos";
import { Paginacao } from "@/components/paginacao";
import { faixaPreco, numero, urlFoto } from "@/lib/formato";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Produtos · Galé Comercial" };

const POR_PAGINA = 25;

type Busca = {
  busca?: string;
  categoria?: string;
  subcategoria?: string;
  fabricante?: string;
  status?: string;
  pagina?: string;
};

export default async function PaginaProdutos({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const de = (pagina - 1) * POR_PAGINA;

  const supabase = await criarClienteServidor();

  // Listas dos filtros. Vêm juntas porque são pequenas e mudam pouco.
  const [{ data: categorias }, { data: subcategorias }, { data: fabricantes }] =
    await Promise.all([
      supabase.from("categorias").select("id, nome").order("nome"),
      supabase.from("subcategorias").select("id, nome, categoria_id").order("nome"),
      supabase.from("fabricantes").select("id, nome").order("nome"),
    ]);

  let consulta = supabase
    .from("produtos")
    .select(
      `id, titulo, modelo, slug, ativo, lancamento,
       categorias(nome), subcategorias(nome), fabricantes(nome),
       kits(pecas),
       produto_imagens(storage_path, principal)`,
      { count: "exact" },
    );

  if (sp.busca?.trim()) {
    // Busca no tsvector mantido pelo gatilho: pega título, referência, tags e
    // descrição de uma vez, com stemming em português ("calcinhas" acha
    // "calcinha").
    consulta = consulta.textSearch("busca", sp.busca.trim(), {
      type: "websearch",
      config: "portuguese",
    });
  }
  // Os filtros chegam como texto na URL e as colunas são numéricas.
  if (sp.categoria) consulta = consulta.eq("categoria_id", Number(sp.categoria));
  if (sp.subcategoria)
    consulta = consulta.eq("subcategoria_id", Number(sp.subcategoria));
  if (sp.fabricante)
    consulta = consulta.eq("fabricante_id", Number(sp.fabricante));
  if (sp.status === "ativo") consulta = consulta.eq("ativo", true);
  if (sp.status === "inativo") consulta = consulta.eq("ativo", false);

  const { data: produtos, count } = await consulta
    .order("titulo")
    .order("modelo")
    .range(de, de + POR_PAGINA - 1);

  const lista = produtos ?? [];

  /*
   * Os preços não vêm no SELECT acima: as colunas de preço são bloqueadas por
   * privilégio de coluna, e a única porta é a view `precos_visiveis`.
   * Uma consulta só, pelos IDs desta página, e agrupamos aqui.
   */
  const ids = lista.map((p) => p.id);
  type Faixa = { min: number; max: number; unitMin: number; unitMax: number };
  const precos = new Map<number, Faixa>();
  if (ids.length) {
    const { data: linhas } = await supabase
      .from("precos_visiveis")
      .select("produto_id, preco_kit_atacado, preco_unitario_atacado")
      .in("produto_id", ids);

    for (const l of linhas ?? []) {
      // A view faz LEFT JOIN, então produto_id pode vir nulo em teoria.
      if (l.produto_id == null) continue;
      const kit = Number(l.preco_kit_atacado ?? 0);
      const unit = Number(l.preco_unitario_atacado ?? 0);
      const atual = precos.get(l.produto_id);
      if (!atual) {
        precos.set(l.produto_id, {
          min: kit, max: kit, unitMin: unit, unitMax: unit,
        });
      } else {
        atual.min = Math.min(atual.min, kit);
        atual.max = Math.max(atual.max, kit);
        atual.unitMin = Math.min(atual.unitMin, unit);
        atual.unitMax = Math.max(atual.unitMax, unit);
      }
    }
  }

  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const filtrando = !!(
    sp.busca || sp.categoria || sp.subcategoria || sp.fabricante || sp.status
  );

  return (
    <div className="px-8 py-7">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-texto">
            Produtos
          </h1>
          <p className="mt-1 text-sm text-suave">
            {numero(total)}{" "}
            {total === 1 ? "produto encontrado" : "produtos encontrados"}
            {filtrando && " com os filtros aplicados"}
          </p>
        </div>
        <Link
          href="/admin/produtos/novo"
          className="flex h-9 items-center gap-1.5 rounded-lg bg-acento px-3.5 text-sm font-semibold text-white transition hover:bg-acento-forte"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
            <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Novo produto
        </Link>
      </header>

      <div className="mb-4">
        <FiltrosProdutos
          categorias={categorias ?? []}
          subcategorias={subcategorias ?? []}
          fabricantes={fabricantes ?? []}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-borda bg-superficie">
        {lista.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-texto">
              Nenhum produto encontrado
            </p>
            <p className="mt-1 text-sm text-suave">
              {filtrando
                ? "Tente afrouxar os filtros ou buscar por outro termo."
                : "Cadastre o primeiro produto do catálogo."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-tenue">
                  <th className="px-4 py-3 font-medium">Produto</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Fabricante</th>
                  <th className="px-4 py-3 text-center font-medium">Kit</th>
                  <th className="px-4 py-3 text-right font-medium">Atacado (kit)</th>
                  <th className="px-4 py-3 text-center font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => {
                  const foto =
                    p.produto_imagens?.find((i) => i.principal) ??
                    p.produto_imagens?.[0];
                  const preco = precos.get(p.id);
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-borda last:border-0 transition hover:bg-superficie-2"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/admin/produtos/${p.id}`}
                          className="flex items-center gap-3"
                        >
                          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-borda bg-superficie-2">
                            {foto ? (
                              <Image
                                src={urlFoto(foto.storage_path)!}
                                alt=""
                                fill
                                sizes="44px"
                                className="object-cover"
                              />
                            ) : (
                              <span className="flex h-full items-center justify-center text-[10px] text-tenue">
                                sem foto
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-medium text-texto">
                                {p.titulo}
                              </span>
                              {p.lancamento && (
                                <span className="shrink-0 rounded bg-acento-texto/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-acento-texto">
                                  Lanç.
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-suave">
                              ref. {p.modelo}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-suave">
                        <div className="text-texto">{p.categorias?.nome}</div>
                        {p.subcategorias?.nome && (
                          <div className="text-xs">{p.subcategorias.nome}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-suave">
                        {p.fabricantes?.nome ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-suave">
                        {p.kits?.pecas}{" "}
                        {p.kits?.pecas === 1 ? "peça" : "peças"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        <div className="font-medium text-texto">
                          {preco ? faixaPreco(preco.min, preco.max) : "—"}
                        </div>
                        {preco && (
                          /* O mesmo cálculo que o cliente vê no catálogo:
                             preço do kit dividido pelas peças. Mostrar aqui
                             deixa o Arthur conferir na hora se o valor do kit
                             faz sentido por peça. */
                          <div className="text-xs text-suave">
                            {faixaPreco(preco.unitMin, preco.unitMax)} /peça
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.ativo
                              ? "bg-ok-fundo text-ok-texto"
                              : "bg-tenue/15 text-suave"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${p.ativo ? "bg-ok-texto" : "bg-tenue"}`}
                          />
                          {p.ativo ? "Ativo" : "Desativado"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {paginas > 1 && (
        <Paginacao pagina={pagina} paginas={paginas} total={total} />
      )}
    </div>
  );
}
