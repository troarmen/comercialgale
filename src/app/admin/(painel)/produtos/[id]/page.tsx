import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ExcluirProduto } from "./excluir";
import { FormularioProduto } from "./formulario";
import { Fotos } from "./fotos";

export const metadata: Metadata = { title: "Produto · Galé Comercial" };

export async function carregarListas() {
  const supabase = await criarClienteServidor();
  const [cat, sub, fab, kits, tam] = await Promise.all([
    supabase.from("categorias").select("id, nome").eq("ativo", true).order("ordem").order("nome"),
    supabase.from("subcategorias").select("id, nome, categoria_id").eq("ativo", true).order("nome"),
    supabase.from("fabricantes").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("kits").select("id, pecas").eq("ativo", true).order("pecas"),
    supabase.from("tamanhos").select("id, valor, tipo").eq("ativo", true).order("ordem").order("valor"),
  ]);
  return {
    categorias: cat.data ?? [],
    subcategorias: sub.data ?? [],
    fabricantes: fab.data ?? [],
    kits: kits.data ?? [],
    tamanhos: tam.data ?? [],
  };
}

export default async function PaginaProduto({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await criarClienteServidor();

  const [{ data: produto }, listas] = await Promise.all([
    supabase
      .from("produtos")
      .select(
        `id, titulo, modelo, descricao, tags, categoria_id, subcategoria_id,
         fabricante_id, kit_id, ncm, possui_st, ativo, lancamento, legado_id`,
      )
      .eq("id", Number(id))
      .maybeSingle(),
    carregarListas(),
  ]);

  if (!produto) notFound();

  // Preço vem pela view: as colunas de preço da tabela são bloqueadas por
  // privilégio de coluna (a trava que impede visitante de ver valor).
  const { data: precos } = await supabase
    .from("precos_visiveis")
    .select(
      "produto_tamanho_id, preco_base_atacado, preco_base_varejo, preco_proprio_atacado, preco_proprio_varejo",
    )
    .eq("produto_id", produto.id);

  const [{ data: variacoes }, { data: fotos }, { count: emPedidos }] =
    await Promise.all([
      // Sem as colunas de preço: elas são bloqueadas por privilégio de
      // coluna. Os valores vêm da view `precos_visiveis`, logo acima.
      supabase
        .from("produto_tamanhos")
        .select("id, tamanho_id, ordem")
        .eq("produto_id", produto.id)
        .order("ordem"),
      supabase
        .from("produto_imagens")
        .select("id, storage_path, principal, ordem")
        .eq("produto_id", produto.id)
        .order("ordem"),
      supabase
        .from("pedido_itens")
        .select("id", { count: "exact", head: true })
        .eq("produto_id", produto.id),
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

  return (
    <div className="px-8 py-7">
      <nav className="mb-3 text-sm text-suave">
        <Link href="/admin/produtos" className="transition hover:text-texto">
          Produtos
        </Link>
        <span className="px-1.5 text-tenue">/</span>
        <span className="text-texto">{produto.titulo}</span>
      </nav>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-texto">
            {produto.titulo}
          </h1>
          <p className="mt-1 text-sm text-suave">
            ref. {produto.modelo}
            {produto.legado_id && ` · vindo do sistema antigo`}
            {emPedidos ? ` · em ${emPedidos} pedidos` : ""}
          </p>
        </div>
        <ExcluirProduto id={produto.id} emPedidos={emPedidos ?? 0} />
      </header>

      <div className="max-w-4xl space-y-4">
        <Fotos produtoId={produto.id} fotos={fotos ?? []} />

        <FormularioProduto
          p={{
            ...produto,
            tags: produto.tags ?? [],
            preco_atacado: Number(base?.preco_base_atacado ?? 0),
            preco_varejo: Number(base?.preco_base_varejo ?? 0),
          }}
          listas={listas}
          grade={(variacoes ?? []).map((v) => ({
            tamanho_id: v.tamanho_id,
            preco_atacado: proprio.get(v.id)?.atacado ?? null,
            preco_varejo: proprio.get(v.id)?.varejo ?? null,
          }))}
        />
      </div>
    </div>
  );
}
