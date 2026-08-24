import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { CartaoProduto, GradeProdutos } from "@/components/catalogo/cartao-produto";
import { ComprarProduto, type LinhaGrade } from "@/components/catalogo/comprar-produto";
import { GaleriaProduto } from "@/components/catalogo/galeria-produto";
import { Trilha, type ItemTrilha } from "@/components/catalogo/trilha";
import {
  configPublica,
  precosDoProduto,
  precosPorProduto,
  produtoPorSlug,
  produtosRelacionados,
  slugsPorLegado,
} from "@/lib/catalogo";
import { urlFoto } from "@/lib/formato";
import { dadosProduto, dadosTrilha, JsonLd } from "@/lib/seo";

/**
 * Ficha do produto.
 *
 * Aceita também o endereço do site antigo (/produto/1860/cueca_boxer_adulto):
 * primeiro segmento numérico é `legado_id` e vira 301 para o slug novo.
 */

async function resolverSlug(caminho: string[]) {
  if (/^\d+$/.test(caminho[0] ?? "")) {
    const slug = await slugsPorLegado("produto", Number(caminho[0]));
    if (slug) permanentRedirect(`/produto/${slug}`);
    notFound();
  }
  if (caminho.length !== 1) notFound();
  return caminho[0];
}

export async function generateMetadata(
  props: PageProps<"/produto/[...caminho]">,
): Promise<Metadata> {
  const { caminho } = await props.params;
  if (/^\d+$/.test(caminho[0] ?? "")) return {};

  const produto = await produtoPorSlug(decodeURIComponent(caminho[0] ?? ""));
  if (!produto) return {};

  const marca = produto.fabricantes?.nome;
  const categoria = produto.categorias?.nome;
  const fotoPrincipal = produto.produto_imagens[0];
  const resumoDescricao = produto.descricao
    ?.replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);

  return {
    title: `${produto.titulo} ${produto.modelo}${marca ? ` — ${marca}` : ""} no Atacado`,
    description:
      resumoDescricao ||
      `${produto.titulo} (ref. ${produto.modelo})${marca ? ` da ${marca}` : ""} no atacado da Comercial Galé${categoria ? `, linha ${categoria.toLowerCase()}` : ""}. Kit fechado para revenda, direto de São Paulo.`,
    alternates: { canonical: `/produto/${produto.slug}` },
    openGraph: {
      type: "website",
      title: `${produto.titulo} — ref. ${produto.modelo}`,
      ...(fotoPrincipal
        ? { images: [{ url: urlFoto(fotoPrincipal.storage_path)! }] }
        : {}),
    },
  };
}

export default async function PaginaProduto(
  props: PageProps<"/produto/[...caminho]">,
) {
  const { caminho } = await props.params;
  const slug = await resolverSlug(caminho.map(decodeURIComponent));

  const produto = await produtoPorSlug(slug);
  if (!produto) notFound();

  const [precos, relacionados, config] = await Promise.all([
    precosDoProduto(produto.id),
    produtosRelacionados(produto),
    configPublica(),
  ]);
  const precosRelacionados = await precosPorProduto(relacionados.map((p) => p.id));

  const pecas = produto.kits?.pecas ?? 1;
  const fotos = produto.produto_imagens.map((i) => ({
    id: i.id,
    url: urlFoto(i.storage_path)!,
    alt: i.alt,
  }));

  const grade: LinhaGrade[] = precos.map((l) => ({
    produtoTamanhoId: l.produto_tamanho_id,
    tamanho: l.tamanho,
    precoKitAtacado: Number(l.preco_kit_atacado ?? 0),
    precoKitVarejo: Number(l.preco_kit_varejo ?? 0),
    precoUnitarioAtacado: Number(l.preco_unitario_atacado ?? 0),
  }));

  const tamanhosSemPreco = produto.produto_tamanhos
    .map((t) => t.tamanhos?.valor)
    .filter((v): v is string => !!v);

  const trilha: ItemTrilha[] = [{ nome: "Produtos", href: "/produtos" }];
  if (produto.categorias) {
    trilha.push({
      nome: produto.categorias.nome,
      href: `/produtos/${produto.categorias.slug}`,
    });
    if (produto.subcategorias) {
      trilha.push({
        nome: produto.subcategorias.nome,
        href: `/produtos/${produto.categorias.slug}/${produto.subcategorias.slug}`,
      });
    }
  }
  trilha.push({ nome: produto.titulo });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <JsonLd
        dados={[
          dadosTrilha(trilha),
          dadosProduto({
            titulo: produto.titulo,
            modelo: produto.modelo,
            slug: produto.slug,
            descricao: produto.descricao,
            fabricante: produto.fabricantes?.nome ?? null,
            categoria: produto.subcategorias?.nome ?? produto.categorias?.nome ?? null,
            imagens: fotos.map((f) => f.url),
          }),
        ]}
      />
      <Trilha itens={trilha} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <GaleriaProduto fotos={fotos} titulo={produto.titulo} />

        <div>
          {produto.fabricantes && (
            <Link
              href={`/marcas/${produto.fabricantes.slug}`}
              className="text-xs font-semibold uppercase tracking-wider text-acento-texto transition hover:text-acento-forte"
            >
              {produto.fabricantes.nome}
            </Link>
          )}
          <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight text-texto sm:text-3xl">
            {produto.titulo}
          </h1>

          <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-suave">
            <div className="flex gap-1.5">
              <dt>Referência:</dt>
              <dd className="font-medium text-texto">{produto.modelo}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Venda:</dt>
              <dd className="font-medium text-texto">
                kit com {pecas} {pecas === 1 ? "peça" : "peças"}
              </dd>
            </div>
            {produto.lancamento && (
              <span className="rounded-full bg-acento px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Lançamento
              </span>
            )}
          </dl>

          <div className="mt-5">
            <ComprarProduto
              produto={{
                id: produto.id,
                slug: produto.slug,
                titulo: produto.titulo,
                modelo: produto.modelo,
                foto: produto.produto_imagens[0]?.storage_path ?? null,
              }}
              grade={grade}
              tamanhosSemPreco={tamanhosSemPreco}
              pecasNoKit={pecas}
              exibirVarejo={config.exibirVarejo}
            />
          </div>

          {produto.descricao && (
            <section className="mt-6" aria-labelledby="titulo-descricao">
              <h2 id="titulo-descricao" className="text-sm font-semibold uppercase tracking-wider text-tenue">
                Descrição
              </h2>
              {/* As quebras de parágrafo vêm do banco como \n\n — pre-line preserva */}
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-suave">
                {produto.descricao}
              </p>
            </section>
          )}
        </div>
      </div>

      {relacionados.length > 0 && (
        <section className="mt-14" aria-labelledby="titulo-relacionados">
          <h2 id="titulo-relacionados" className="mb-5 text-xl font-bold tracking-tight text-texto">
            Quem compra este produto também olha
          </h2>
          <GradeProdutos>
            {relacionados.map((p) => (
              <CartaoProduto key={p.id} produto={p} faixa={precosRelacionados.get(p.id)} />
            ))}
          </GradeProdutos>
        </section>
      )}
    </div>
  );
}
