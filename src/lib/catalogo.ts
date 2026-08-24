import { cache } from "react";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * Camada de dados do catálogo público.
 *
 * Tudo aqui roda no servidor com o cliente anon + cookies: o RLS decide o que
 * cada visitante enxerga. Preço NUNCA sai das tabelas — só da view
 * `precos_visiveis`, que devolve zero linhas para quem não pode ver.
 *
 * As funções usam `cache()` do React: o layout e a página pedem o mesmo menu
 * na mesma requisição e o banco é consultado uma vez só.
 */

export const POR_PAGINA = 24;

// ---------------------------------------------------------------- estrutura

export type CategoriaMenu = {
  id: number;
  nome: string;
  slug: string;
  descricao: string | null;
  imagem_path: string | null;
  subcategorias: {
    id: number;
    nome: string;
    slug: string;
    descricao: string | null;
  }[];
};

/** Categorias ativas com as subcategorias, na ordem definida no painel. */
export const arvoreCategorias = cache(async (): Promise<CategoriaMenu[]> => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("categorias")
    .select(
      "id, nome, slug, descricao, imagem_path, subcategorias(id, nome, slug, descricao, ativo, ordem)",
    )
    .eq("ativo", true)
    .order("ordem")
    .order("nome");

  return (data ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    slug: c.slug,
    descricao: c.descricao,
    imagem_path: c.imagem_path,
    subcategorias: (c.subcategorias ?? [])
      .filter((s) => s.ativo)
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt"))
      .map(({ id, nome, slug, descricao }) => ({ id, nome, slug, descricao })),
  }));
});

/** Marcas ativas com a contagem de produtos ativos (a partir de uma coluna
 *  concedida — agregado direto em `produtos` é barrado pela trava de preço). */
export const marcasComContagem = cache(async () => {
  const supabase = await criarClienteServidor();
  const [{ data: fabricantes }, { data: usos }] = await Promise.all([
    supabase
      .from("fabricantes")
      .select("id, nome, slug, descricao")
      .eq("ativo", true)
      .order("nome"),
    supabase.from("produtos").select("fabricante_id").eq("ativo", true),
  ]);

  const contagem = new Map<number, number>();
  for (const u of usos ?? []) {
    if (u.fabricante_id == null) continue;
    contagem.set(u.fabricante_id, (contagem.get(u.fabricante_id) ?? 0) + 1);
  }

  return (fabricantes ?? [])
    .map((f) => ({ ...f, produtos: contagem.get(f.id) ?? 0 }))
    .filter((f) => f.produtos > 0)
    .sort((a, b) => b.produtos - a.produtos || a.nome.localeCompare(b.nome, "pt"));
});

/** Total de produtos ativos — número real exibido no hero.
 *  Contagem por coluna concedida (agregado direto é barrado pela trava). */
export const contarProdutosAtivos = cache(async () => {
  const supabase = await criarClienteServidor();
  const { count } = await supabase
    .from("produtos")
    .select("id", { count: "exact", head: true })
    .eq("ativo", true);
  return count ?? 0;
});

// ------------------------------------------------------------- configurações

/** As três chaves públicas de `configuracoes`, com valores padrão seguros. */
export const configPublica = cache(async () => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("configuracoes").select("chave, valor");

  const mapa = new Map((data ?? []).map((c) => [c.chave, c.valor]));
  return {
    pedidoMinimo: Number(mapa.get("pedido_minimo_valor") ?? 0) || 0,
    aviso: String(mapa.get("catalogo_aviso") ?? "").trim(),
    exibirVarejo: mapa.get("exibir_preco_varejo") !== false,
  };
});

// -------------------------------------------------------------------- sessão

/**
 * Quem está navegando: visitante, cliente aguardando liberação ou cliente
 * ativo. O RLS só devolve o próprio cadastro, então a consulta é barata.
 */
export const sessaoCatalogo = cache(async () => {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, cliente: null };

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nome, nome_fantasia, status, pode_ver_precos")
    .eq("user_id", user.id)
    .maybeSingle();

  return { user, cliente };
});

// ------------------------------------------------------------------ listagem

export type FiltrosListagem = {
  busca?: string;
  categoriaId?: number;
  subcategoriaId?: number;
  fabricanteId?: number;
  lancamentos?: boolean;
  ordem?: "destaques" | "recentes" | "nome";
  pagina?: number;
  porPagina?: number;
};

export type ProdutoResumo = {
  id: number;
  titulo: string;
  modelo: string;
  slug: string;
  lancamento: boolean;
  categorias: { nome: string; slug: string } | null;
  subcategorias: { nome: string; slug: string } | null;
  fabricantes: { nome: string; slug: string } | null;
  kits: { pecas: number } | null;
  produto_imagens: { storage_path: string; alt: string | null; principal: boolean }[];
};

/** Listagem pública com filtros. Nunca toca em coluna de preço. */
export async function listarProdutos(filtros: FiltrosListagem) {
  const supabase = await criarClienteServidor();
  const porPagina = filtros.porPagina ?? POR_PAGINA;
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const de = (pagina - 1) * porPagina;

  let consulta = supabase
    .from("produtos")
    .select(
      `id, titulo, modelo, slug, lancamento,
       categorias(nome, slug), subcategorias(nome, slug),
       fabricantes(nome, slug), kits(pecas),
       produto_imagens(storage_path, alt, principal)`,
      { count: "exact" },
    )
    .eq("ativo", true);

  if (filtros.busca?.trim()) {
    consulta = consulta.textSearch("busca", filtros.busca.trim(), {
      type: "websearch",
      config: "portuguese",
    });
  }
  if (filtros.categoriaId) consulta = consulta.eq("categoria_id", filtros.categoriaId);
  if (filtros.subcategoriaId)
    consulta = consulta.eq("subcategoria_id", filtros.subcategoriaId);
  if (filtros.fabricanteId)
    consulta = consulta.eq("fabricante_id", filtros.fabricanteId);
  if (filtros.lancamentos) consulta = consulta.eq("lancamento", true);

  if (filtros.ordem === "recentes") {
    consulta = consulta.order("created_at", { ascending: false });
  } else if (filtros.ordem === "nome") {
    consulta = consulta.order("titulo").order("modelo");
  } else {
    // padrão: lançamentos abrem a vitrine, o resto em ordem alfabética
    consulta = consulta.order("lancamento", { ascending: false }).order("titulo");
  }

  const { data, count } = await consulta.range(de, de + porPagina - 1);
  const produtos = (data ?? []) as ProdutoResumo[];

  return {
    produtos,
    total: count ?? 0,
    pagina,
    paginas: Math.max(1, Math.ceil((count ?? 0) / porPagina)),
  };
}

// --------------------------------------------------------------------- preço

export type FaixaPreco = {
  kitMin: number;
  kitMax: number;
  unitarioMin: number;
  unitarioMax: number;
  varejoMin: number;
  varejoMax: number;
};

/**
 * Faixa de preço por produto, para os cartões da vitrine.
 * Devolve um Map VAZIO para visitante sem login — é a view quem decide.
 */
export async function precosPorProduto(ids: number[]) {
  const faixas = new Map<number, FaixaPreco>();
  if (!ids.length) return faixas;

  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("precos_visiveis")
    .select(
      "produto_id, preco_kit_atacado, preco_unitario_atacado, preco_kit_varejo",
    )
    .in("produto_id", ids);

  for (const l of data ?? []) {
    if (l.produto_id == null) continue;
    const kit = Number(l.preco_kit_atacado ?? 0);
    const unit = Number(l.preco_unitario_atacado ?? 0);
    const varejo = Number(l.preco_kit_varejo ?? 0);
    const atual = faixas.get(l.produto_id);
    if (!atual) {
      faixas.set(l.produto_id, {
        kitMin: kit,
        kitMax: kit,
        unitarioMin: unit,
        unitarioMax: unit,
        varejoMin: varejo,
        varejoMax: varejo,
      });
    } else {
      atual.kitMin = Math.min(atual.kitMin, kit);
      atual.kitMax = Math.max(atual.kitMax, kit);
      atual.unitarioMin = Math.min(atual.unitarioMin, unit);
      atual.unitarioMax = Math.max(atual.unitarioMax, unit);
      atual.varejoMin = Math.min(atual.varejoMin, varejo);
      atual.varejoMax = Math.max(atual.varejoMax, varejo);
    }
  }
  return faixas;
}

// ------------------------------------------------------------------- produto

/** Ficha completa de um produto ativo, pelo slug. */
export const produtoPorSlug = cache(async (slug: string) => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("produtos")
    .select(
      `id, titulo, modelo, slug, descricao, tags, lancamento, updated_at,
       categoria_id, subcategoria_id, fabricante_id,
       categorias(id, nome, slug), subcategorias(id, nome, slug),
       fabricantes(id, nome, slug), kits(pecas, descricao),
       produto_imagens(id, storage_path, alt, ordem, principal),
       produto_tamanhos(id, ativo, ordem, tamanhos(id, valor, tipo, ordem))`,
    )
    .eq("slug", slug)
    .eq("ativo", true)
    .maybeSingle();

  if (!data) return null;

  return {
    ...data,
    produto_imagens: [...(data.produto_imagens ?? [])].sort(
      (a, b) => Number(b.principal) - Number(a.principal) || a.ordem - b.ordem,
    ),
    produto_tamanhos: (data.produto_tamanhos ?? [])
      .filter((t) => t.ativo && t.tamanhos)
      .sort(
        (a, b) =>
          a.ordem - b.ordem || (a.tamanhos?.ordem ?? 0) - (b.tamanhos?.ordem ?? 0),
      ),
  };
});

/** Preços de um produto por tamanho (vazio para quem não pode ver). */
export async function precosDoProduto(produtoId: number) {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("precos_visiveis")
    .select(
      `produto_tamanho_id, tamanho, pecas_no_kit,
       preco_kit_atacado, preco_kit_varejo,
       preco_unitario_atacado, preco_unitario_varejo`,
    )
    .eq("produto_id", produtoId);
  return data ?? [];
}

/** Produtos da mesma subcategoria (ou categoria), excluindo o atual. */
export async function produtosRelacionados(produto: {
  id: number;
  categoria_id: number;
  subcategoria_id: number | null;
}) {
  const filtros: FiltrosListagem = { porPagina: 8, ordem: "destaques" };
  if (produto.subcategoria_id) filtros.subcategoriaId = produto.subcategoria_id;
  else filtros.categoriaId = produto.categoria_id;

  const { produtos } = await listarProdutos(filtros);
  const outros = produtos.filter((p) => p.id !== produto.id).slice(0, 4);

  // Subcategoria pequena demais? Completa com produtos da categoria.
  if (outros.length < 4 && produto.subcategoria_id) {
    const { produtos: daCategoria } = await listarProdutos({
      categoriaId: produto.categoria_id,
      porPagina: 12,
      ordem: "destaques",
    });
    for (const p of daCategoria) {
      if (p.id !== produto.id && !outros.some((o) => o.id === p.id)) {
        outros.push(p);
        if (outros.length === 4) break;
      }
    }
  }
  return outros;
}

// ----------------------------------------------------- resolução de caminhos

export const categoriaPorSlug = cache(async (slug: string) => {
  const arvore = await arvoreCategorias();
  return arvore.find((c) => c.slug === slug) ?? null;
});

/** Redirecionamentos do site antigo: resolve `legado_id` → slug novo. */
export async function slugsPorLegado(tipo: "categoria" | "subcategoria" | "produto", legadoId: number) {
  const supabase = await criarClienteServidor();
  if (tipo === "produto") {
    const { data } = await supabase
      .from("produtos")
      .select("slug")
      .eq("legado_id", legadoId)
      .maybeSingle();
    return data?.slug ?? null;
  }
  if (tipo === "categoria") {
    const { data } = await supabase
      .from("categorias")
      .select("slug")
      .eq("legado_id", legadoId)
      .maybeSingle();
    return data?.slug ?? null;
  }
  const { data } = await supabase
    .from("subcategorias")
    .select("slug, categorias(slug)")
    .eq("legado_id", legadoId)
    .maybeSingle();
  return data ? `${data.categorias?.slug}/${data.slug}` : null;
}

/** Uma foto de vitrine por categoria, para os cartões da home. */
export const fotoDaCategoria = cache(async (categoriaId: number) => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("produtos")
    .select("produto_imagens!inner(storage_path)")
    .eq("categoria_id", categoriaId)
    .eq("ativo", true)
    .order("lancamento", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.produto_imagens?.[0]?.storage_path ?? null;
});
