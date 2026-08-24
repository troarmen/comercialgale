import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Trilha } from "@/components/catalogo/trilha";
import { Vitrine } from "@/components/catalogo/vitrine";
import {
  categoriaPorSlug,
  slugsPorLegado,
  type CategoriaMenu,
} from "@/lib/catalogo";
import { dadosTrilha, JsonLd } from "@/lib/seo";

/**
 * Páginas de categoria e subcategoria — e a porta de entrada dos endereços do
 * site antigo, que usavam IDs numéricos:
 *
 *   /produtos/lingerie                    → categoria (novo)
 *   /produtos/lingerie/tangas-adultos     → subcategoria (novo)
 *   /produtos/47/lingerie                 → 301 para /produtos/lingerie
 *   /produtos/47/11/tangas adultos        → 301 para /produtos/lingerie/tangas-adultos
 *
 * O `legado_id` gravado na migração é quem resolve o redirecionamento.
 */

type Busca = { marca?: string; ordem?: string; pagina?: string };

async function resolver(caminho: string[]) {
  // Endereço do site antigo? Primeiro segmento numérico entrega.
  if (/^\d+$/.test(caminho[0] ?? "")) {
    const destino =
      caminho.length >= 3 && /^\d+$/.test(caminho[1])
        ? await slugsPorLegado("subcategoria", Number(caminho[1]))
        : await slugsPorLegado("categoria", Number(caminho[0]));
    if (destino) permanentRedirect(`/produtos/${destino}`);
    notFound();
  }

  const categoria = await categoriaPorSlug(caminho[0]);
  if (!categoria || caminho.length > 2) notFound();

  const subcategoria =
    caminho.length === 2
      ? categoria.subcategorias.find((s) => s.slug === caminho[1])
      : undefined;
  if (caminho.length === 2 && !subcategoria) notFound();

  return { categoria, subcategoria };
}

export async function generateMetadata(
  props: PageProps<"/produtos/[...caminho]">,
): Promise<Metadata> {
  const { caminho } = await props.params;
  if (/^\d+$/.test(caminho[0] ?? "")) return {};

  const categoria = await categoriaPorSlug(caminho[0]);
  if (!categoria) return {};
  const sub = categoria.subcategorias.find((s) => s.slug === caminho[1]);

  const sp = await props.searchParams;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const base = sub
    ? `/produtos/${categoria.slug}/${sub.slug}`
    : `/produtos/${categoria.slug}`;
  const filtrado = !!(sp.marca || sp.ordem);

  if (sub) {
    return {
      title: `${sub.nome} — ${categoria.nome} no Atacado`,
      description:
        sub.descricao ??
        `${sub.nome} no atacado para lojistas: linha ${categoria.nome.toLowerCase()} da Comercial Galé, em kits fechados com preço de revenda sugerido. Desde 1976 em São Paulo.`,
      ...(filtrado ? { robots: { index: false, follow: true } } : {}),
      alternates: { canonical: pagina > 1 ? `${base}?pagina=${pagina}` : base },
    };
  }

  const linhas = categoria.subcategorias
    .slice(0, 4)
    .map((s) => s.nome.toLowerCase())
    .join(", ");
  return {
    title: `${categoria.nome} no Atacado para Revenda`,
    description:
      categoria.descricao ??
      `${categoria.nome} no atacado para a sua loja${linhas ? `: ${linhas} e mais` : ""}. Kits fechados, preço de revenda sugerido e atendimento direto da 25 de Março, em São Paulo.`,
    ...(filtrado ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical: pagina > 1 ? `${base}?pagina=${pagina}` : base },
  };
}

function ChipsSubcategorias({
  categoria,
  ativa,
}: {
  categoria: CategoriaMenu;
  ativa?: string;
}) {
  if (!categoria.subcategorias.length) return null;
  return (
    <nav aria-label={`Linhas de ${categoria.nome}`} className="mt-4 flex flex-wrap gap-2">
      <Link
        href={`/produtos/${categoria.slug}`}
        className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
          !ativa
            ? "border-acento bg-acento text-white shadow-cta"
            : "border-borda bg-superficie text-suave shadow-pousada hover:border-gale-500 hover:text-acento-texto hover:shadow-suave"
        }`}
      >
        Tudo
      </Link>
      {categoria.subcategorias.map((s) => (
        <Link
          key={s.id}
          href={`/produtos/${categoria.slug}/${s.slug}`}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
            ativa === s.slug
              ? "border-acento bg-acento text-white shadow-cta"
              : "border-borda bg-superficie text-suave shadow-pousada hover:border-gale-500 hover:text-acento-texto hover:shadow-suave"
          }`}
        >
          {s.nome}
        </Link>
      ))}
    </nav>
  );
}

export default async function PaginaCategoria(
  props: PageProps<"/produtos/[...caminho]">,
) {
  const { caminho } = await props.params;
  const sp = (await props.searchParams) as Busca;
  const { categoria, subcategoria } = await resolver(
    caminho.map(decodeURIComponent),
  );

  const base = subcategoria
    ? `/produtos/${categoria.slug}/${subcategoria.slug}`
    : `/produtos/${categoria.slug}`;

  const trilha = subcategoria
    ? [
        { nome: "Produtos", href: "/produtos" },
        { nome: categoria.nome, href: `/produtos/${categoria.slug}` },
        { nome: subcategoria.nome },
      ]
    : [{ nome: "Produtos", href: "/produtos" }, { nome: categoria.nome }];

  const atual = subcategoria ?? categoria;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <JsonLd dados={dadosTrilha(trilha)} />
      <Trilha itens={trilha} />

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-texto">
          {subcategoria
            ? `${subcategoria.nome} · ${categoria.nome}`
            : `${categoria.nome} no atacado`}
        </h1>
        {atual.descricao ? (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-suave">
            {atual.descricao}
          </p>
        ) : (
          <p className="mt-1 max-w-2xl text-sm text-suave">
            Kits fechados com preço de atacado e revenda sugerida para lojistas.
          </p>
        )}
        <ChipsSubcategorias categoria={categoria} ativa={subcategoria?.slug} />
      </header>

      <Vitrine
        filtros={{
          categoriaId: categoria.id,
          subcategoriaId: subcategoria?.id,
          fabricanteId: Number(sp.marca) || undefined,
          ordem: (["recentes", "nome"].includes(sp.ordem ?? "")
            ? sp.ordem
            : undefined) as "recentes" | "nome" | undefined,
          pagina: Math.max(1, Number(sp.pagina) || 1),
        }}
        caminho={base}
        parametros={{ marca: sp.marca, ordem: sp.ordem }}
      />
    </div>
  );
}
