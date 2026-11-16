import { criarClienteServidor } from "@/lib/supabase/server";
import type { DadosProduto, Listas } from "./formulario";
import type { LinhaGrade } from "./grade";

/**
 * Leitura do produto para o formulário do painel — usada pela ficha
 * (`/admin/produtos/[id]`) e pelo Duplicar (`/admin/produtos/novo?de=[id]`).
 */

/** Valores que o produto já usa: entram nas listas mesmo se estiverem inativos. */
type EmUso = {
  categoria_id?: number | null;
  subcategoria_id?: number | null;
  fabricante_id?: number | null;
  kit_id?: number | null;
  tamanhos?: number[];
};

/**
 * Filtro "ativo OU já usado por este produto".
 *
 * Só ativos não basta: um produto de categoria (ou kit, fabricante…) que foi
 * desativada abriria com o <select> em "Escolha…", como se tivesse perdido o
 * valor — e salvar obrigaria a trocar. O que está em uso aparece, marcado
 * como inativo, para o Arthur decidir.
 */
function ativosOu(ids: (number | null | undefined)[]) {
  const validos = ids.filter((x): x is number => typeof x === "number" && x > 0);
  return validos.length ? `ativo.eq.true,id.in.(${validos.join(",")})` : "ativo.eq.true";
}

export async function carregarListas(emUso: EmUso = {}): Promise<Listas> {
  const supabase = await criarClienteServidor();
  const [cat, sub, fab, kits, tam] = await Promise.all([
    supabase.from("categorias").select("id, nome, ativo").or(ativosOu([emUso.categoria_id])).order("ordem").order("nome"),
    supabase.from("subcategorias").select("id, nome, categoria_id, ativo").or(ativosOu([emUso.subcategoria_id])).order("nome"),
    supabase.from("fabricantes").select("id, nome, ativo").or(ativosOu([emUso.fabricante_id])).order("nome"),
    supabase.from("kits").select("id, pecas, ativo").or(ativosOu([emUso.kit_id])).order("pecas"),
    supabase.from("tamanhos").select("id, valor, tipo, ativo").or(ativosOu(emUso.tamanhos ?? [])).order("ordem").order("valor"),
  ]);
  return {
    categorias: cat.data ?? [],
    subcategorias: sub.data ?? [],
    fabricantes: fab.data ?? [],
    kits: kits.data ?? [],
    tamanhos: tam.data ?? [],
  };
}

/**
 * Produto, grade e listas, no formato do formulário. `null` se não existir.
 *
 * Preço vem SÓ da view `precos_visiveis`: as colunas de preço das tabelas
 * são bloqueadas por privilégio de coluna (a trava que impede visitante de
 * ver valor). O admin enxerga a view inteira.
 */
export async function carregarProduto(id: number) {
  if (!Number.isInteger(id) || id <= 0) return null;
  const supabase = await criarClienteServidor();

  const { data: produto } = await supabase
    .from("produtos")
    .select(
      `id, titulo, modelo, descricao, tags, categoria_id, subcategoria_id,
       fabricante_id, kit_id, ncm, possui_st, ativo, lancamento, legado_id`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!produto) return null;

  const [{ data: precos }, { data: variacoes }] = await Promise.all([
    supabase
      .from("precos_visiveis")
      .select(
        "produto_tamanho_id, preco_base_atacado, preco_base_varejo, preco_proprio_atacado, preco_proprio_varejo",
      )
      .eq("produto_id", produto.id),
    // Sem as colunas de preço, pelo mesmo motivo: os valores vêm da view.
    supabase
      .from("produto_tamanhos")
      .select("id, tamanho_id, ordem")
      .eq("produto_id", produto.id)
      .order("ordem")
      .order("id"),
  ]);

  // O preço do produto é igual em todas as linhas da view; basta a primeira.
  const base = precos?.[0];
  // Preço próprio de cada tamanho, indexado pelo id da variação.
  const proprio = new Map(
    (precos ?? []).map((x) => [
      x.produto_tamanho_id,
      {
        atacado: x.preco_proprio_atacado == null ? null : Number(x.preco_proprio_atacado),
        varejo: x.preco_proprio_varejo == null ? null : Number(x.preco_proprio_varejo),
      },
    ]),
  );

  const grade: LinhaGrade[] = (variacoes ?? []).map((v) => ({
    tamanho_id: v.tamanho_id,
    preco_atacado: proprio.get(v.id)?.atacado ?? null,
    preco_varejo: proprio.get(v.id)?.varejo ?? null,
  }));

  const p: DadosProduto = {
    id: produto.id,
    titulo: produto.titulo,
    modelo: produto.modelo,
    descricao: produto.descricao,
    tags: produto.tags ?? [],
    categoria_id: produto.categoria_id,
    subcategoria_id: produto.subcategoria_id,
    fabricante_id: produto.fabricante_id,
    kit_id: produto.kit_id,
    preco_atacado: Number(base?.preco_base_atacado ?? 0),
    preco_varejo: Number(base?.preco_base_varejo ?? 0),
    ncm: produto.ncm,
    possui_st: produto.possui_st,
    ativo: produto.ativo,
    lancamento: produto.lancamento,
  };

  const listas = await carregarListas({
    categoria_id: p.categoria_id,
    subcategoria_id: p.subcategoria_id,
    fabricante_id: p.fabricante_id,
    kit_id: p.kit_id,
    tamanhos: grade.map((l) => l.tamanho_id),
  });

  return { p, grade, listas, legadoId: produto.legado_id };
}
