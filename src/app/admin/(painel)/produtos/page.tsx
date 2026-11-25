import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  CabecalhoOrdenavel,
  lerOrdem,
  type Direcao,
} from "@/components/cabecalho-ordenavel";
import { FiltrosProdutos } from "@/components/filtros-produtos";
import { Paginacao } from "@/components/paginacao";
import { LembrarLista } from "@/components/voltar";
import { gruposDaBusca } from "@/lib/busca";
import { faixaPreco, numero, urlFoto } from "@/lib/formato";
import { criarClienteServidor } from "@/lib/supabase/server";
import {
  BarraLote,
  CaixaLancamento,
  ListaComLote,
  MarcarLinha,
  MarcarTodos,
} from "./lancamento-lote";

export const metadata: Metadata = { title: "Produtos · Galé Comercial" };

const POR_PAGINA = 25;

type Busca = {
  busca?: string;
  categoria?: string;
  subcategoria?: string;
  fabricante?: string;
  status?: string;
  lancamento?: string;
  ordem?: string;
  dir?: string;
  pagina?: string;
};

/*
 * Colunas que ordenam a lista e a direção do primeiro clique em cada uma.
 * Sem `?ordem=` na URL, a lista sai por nome, como sempre saiu.
 */
const COLUNAS = {
  titulo: "asc",
  modelo: "asc",
  categoria: "asc",
  fabricante: "asc",
  cadastro: "desc",
  // Lançamentos no topo (relatório do cliente de 24/11: "no site antigo
  // víamos todos os lançamentos no topo e desmarcávamos os que deixaram de
  // ser novidade"). Dentro dos lançamentos, os cadastrados por último primeiro.
  lancamento: "desc",
} satisfies Record<string, Direcao>;

/*
 * Data de cadastro em dd/mm/aaaa no fuso de São Paulo. Sem o fuso, o servidor
 * (UTC na Vercel) mostraria o dia seguinte para quem cadastrou depois das 21h.
 */
const DATA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function aZ<T extends { nome: string }>(lista: T[] | null): T[] {
  return [...(lista ?? [])].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
  );
}

export default async function PaginaProdutos({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const de = (pagina - 1) * POR_PAGINA;
  const ordem = lerOrdem(sp, COLUNAS, { campo: "titulo", dir: "asc" });

  const supabase = await criarClienteServidor();

  // Listas dos filtros. Vêm juntas porque são pequenas e mudam pouco.
  const [
    { data: categorias },
    { data: subcategorias },
    { data: fabricantes },
    { count: contaLancamentos },
  ] = await Promise.all([
    supabase.from("categorias").select("id, nome").order("nome"),
    supabase.from("subcategorias").select("id, nome, categoria_id").order("nome"),
    supabase.from("fabricantes").select("id, nome").order("nome"),
    // número do atalho "Lançamentos (N)" do cabeçalho
    supabase
      .from("produtos")
      .select("id", { count: "exact", head: true })
      .eq("lancamento", true),
  ]);
  const totalLancamentos = contaLancamentos ?? null;

  let consulta = supabase
    .from("produtos")
    .select(
      `id, titulo, modelo, slug, ativo, lancamento, created_at,
       categorias(nome), subcategorias(nome), fabricantes(nome),
       kits(pecas),
       produto_imagens(storage_path, principal)`,
      { count: "exact" },
    );

  // A mesma busca do catálogo: nome, referência, descrição, tags, marca e
  // categoria, sem acento e aceitando pedaço de palavra (src/lib/busca.ts).
  for (const grupo of await gruposDaBusca(supabase, sp.busca)) {
    consulta = consulta.or(grupo);
  }
  // Os filtros chegam como texto na URL e as colunas são numéricas.
  if (sp.categoria) consulta = consulta.eq("categoria_id", Number(sp.categoria));
  if (sp.subcategoria)
    consulta = consulta.eq("subcategoria_id", Number(sp.subcategoria));
  if (sp.fabricante)
    consulta = consulta.eq("fabricante_id", Number(sp.fabricante));
  if (sp.status === "ativo") consulta = consulta.eq("ativo", true);
  if (sp.status === "inativo") consulta = consulta.eq("ativo", false);
  if (sp.lancamento === "sim") consulta = consulta.eq("lancamento", true);
  if (sp.lancamento === "nao") consulta = consulta.eq("lancamento", false);

  // Ordem escolhida no título da coluna. Os critérios de desempate ficam
  // sempre de A a Z (dentro do mesmo fabricante, os produtos por nome), e o
  // `id` no fim garante que nenhum produto apareça em duas páginas nem suma
  // entre elas quando vários empatam.
  const asc = ordem.dir === "asc";
  // Produto sem categoria/fabricante vai para o fim nas duas direções.
  const relacionada = { ascending: asc, nullsFirst: false };
  switch (ordem.campo) {
    case "modelo":
      consulta = consulta.order("modelo", { ascending: asc }).order("titulo");
      break;
    case "categoria":
      consulta = consulta
        .order("categorias(nome)", relacionada)
        .order("subcategorias(nome)", { nullsFirst: false })
        .order("titulo");
      break;
    case "fabricante":
      consulta = consulta
        .order("fabricantes(nome)", relacionada)
        .order("titulo")
        .order("modelo");
      break;
    case "cadastro":
      consulta = consulta.order("created_at", { ascending: asc });
      break;
    case "lancamento":
      consulta = consulta
        .order("lancamento", { ascending: asc })
        .order("created_at", { ascending: false })
        .order("titulo");
      break;
    default:
      consulta = consulta.order("titulo", { ascending: asc }).order("modelo");
  }

  // Na data, o `id` acompanha a direção: no mesmo dia, o cadastrado por
  // último aparece primeiro em "mais novos".
  const { data: produtos, count } = await consulta
    .order("id", { ascending: ordem.campo === "cadastro" ? asc : true })
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
    sp.busca ||
    sp.categoria ||
    sp.subcategoria ||
    sp.fabricante ||
    sp.status ||
    sp.lancamento
  );

  // Título de coluna ordenável: mesma lista, mesmos filtros, outra ordem.
  const titulo = (
    campo: keyof typeof COLUNAS,
    rotulo: string,
    tipo?: "data" | "marca",
    className = "px-2",
  ) => (
    <CabecalhoOrdenavel
      campo={campo}
      rotulo={rotulo}
      ordem={ordem}
      primeira={COLUNAS[campo]}
      tipo={tipo}
      className={className}
      caminho="/admin/produtos"
      params={sp}
    />
  );

  return (
    <div className="px-8 py-7">
      {/* Guarda busca, filtros, ordem, página e rolagem para o Voltar da
          ficha do produto devolver a lista como estava. */}
      <LembrarLista chave="produtos" />

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
        <div className="flex flex-wrap items-center gap-2">
          {/* Atalho do jeito do painel antigo: só os lançamentos, os mais
              novos no topo, para desmarcar os que deixaram de ser novidade
              (caixa da linha ou seleção em lote). */}
          <Link
            href="/admin/produtos?lancamento=sim&ordem=cadastro&dir=desc"
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-sm font-medium transition ${
              sp.lancamento === "sim"
                ? "border-acento bg-acento/10 text-acento-texto"
                : "border-borda bg-superficie text-texto hover:bg-superficie-2"
            }`}
          >
            Lançamentos{totalLancamentos !== null && ` (${numero(totalLancamentos)})`}
          </Link>
        <Link
          href="/admin/produtos/novo"
          className="flex h-9 items-center gap-1.5 rounded-lg bg-acento px-3.5 text-sm font-semibold text-white transition hover:bg-acento-forte"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
            <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Novo produto
        </Link>
        </div>
      </header>

      <div className="mb-4">
        {/* A–Z em português no próprio servidor: não depende do idioma de
            ordenação do banco (em "C", acento e minúscula vão para o fim). */}
        <FiltrosProdutos
          categorias={aZ(categorias)}
          subcategorias={aZ(subcategorias)}
          fabricantes={aZ(fabricantes)}
        />
      </div>

      <ListaComLote ids={ids}>
        <BarraLote />

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
                    <th scope="col" className="w-10 py-3 pl-4 pr-1">
                      <MarcarTodos />
                    </th>
                    {titulo("titulo", "Produto")}
                    {titulo("modelo", "Ref.")}
                    {titulo("categoria", "Categoria")}
                    {titulo("fabricante", "Fabricante")}
                    <th scope="col" className="px-2 py-3 text-center font-medium">Kit</th>
                    <th scope="col" className="px-2 py-3 text-right font-medium">Atacado (kit)</th>
                    {titulo("cadastro", "Cadastro", "data")}
                    {/* O título é bem mais largo que a caixa da coluna: com o hífen
                        opcional, ele quebra em "Lança-/mento" só quando falta
                        espaço (1280 px), em vez de empurrar a tabela. */}
                    {titulo("lancamento", "Lança\u00admento", "marca", "px-1 text-center hyphens-manual")}
                    <th scope="col" className="px-2 py-3 text-center font-medium">Situação</th>
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
                        className="border-b border-borda last:border-0 transition hover:bg-superficie-2 has-[[data-selecao]:checked]:bg-superficie-2"
                      >
                        <td className="py-2.5 pl-4 pr-1">
                          <MarcarLinha id={p.id} titulo={p.titulo} />
                        </td>
                        <td className="px-2 py-2.5">
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
                            {/* A marca "Lanç." que ficava aqui virou a coluna
                                Lançamento; a referência, coluna própria. */}
                            <span className="min-w-0 font-medium text-texto">
                              {p.titulo}
                            </span>
                          </Link>
                        </td>
                        <td className="px-2 py-2.5 tabular-nums text-suave">
                          {/* Quase toda referência é curta ("MF 307"); as ~45
                              longas ("1447 (P) / 1454 (M) / 1461 (G)") quebram
                              linha em vez de alargar a tabela inteira. */}
                          <span className="block max-w-36">{p.modelo}</span>
                        </td>
                        <td className="px-2 py-2.5 text-suave">
                          <div className="text-texto">{p.categorias?.nome}</div>
                          {p.subcategorias?.nome && (
                            <div className="text-xs">{p.subcategorias.nome}</div>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-suave">
                          {p.fabricantes?.nome ?? "—"}
                        </td>
                        {/* Número em cima, unidade embaixo (como o preço e o
                            "/peça" ao lado): a coluna fica estreita e igual em
                            todas as linhas, e a tabela cabe em 1280 px. */}
                        <td className="px-2 py-2.5 text-center tabular-nums text-suave">
                          <div>{p.kits?.pecas}</div>
                          <div className="text-xs">
                            {p.kits?.pecas === 1 ? "peça" : "peças"}
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums">
                          <div className="font-medium text-texto">
                            {preco ? faixaPreco(preco.min, preco.max) : "—"}
                          </div>
                          {preco && (
                            /* O mesmo cálculo que o cliente vê no catálogo:
                               preço do kit dividido pelas peças. Mostrar aqui
                               deixa o Arthur conferir na hora se o valor do kit
                               faz sentido por peça. */
                            <div className="text-xs text-suave">
                              {/* espaço que não quebra: "/peça" nunca fica
                                  sozinho na linha de baixo */}
                              {faixaPreco(preco.unitMin, preco.unitMax)}
                              {"\u00a0/peça"}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-suave">
                          {DATA.format(new Date(p.created_at))}
                        </td>
                        <td className="px-2 py-1 text-center">
                          <CaixaLancamento
                            id={p.id}
                            marcado={p.lancamento}
                            titulo={p.titulo}
                          />
                        </td>
                        <td className="px-2 py-2.5 text-center">
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
      </ListaComLote>

      {paginas > 1 && (
        <Paginacao pagina={pagina} paginas={paginas} total={total} />
      )}
    </div>
  );
}
