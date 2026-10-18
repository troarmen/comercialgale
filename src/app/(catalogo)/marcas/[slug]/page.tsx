import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trilha } from "@/components/catalogo/trilha";
import { Vitrine } from "@/components/catalogo/vitrine";
import { marcasComContagem } from "@/lib/catalogo";
import { dadosTrilha, JsonLd } from "@/lib/seo";

type Busca = { ordem?: string; pagina?: string };

async function marcaPorSlug(slug: string) {
  const marcas = await marcasComContagem();
  return marcas.find((m) => m.slug === slug) ?? null;
}

export async function generateMetadata(
  props: PageProps<"/marcas/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const marca = await marcaPorSlug(slug);
  if (!marca) return {};

  const sp = (await props.searchParams) as Busca;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const base = `/marcas/${marca.slug}`;

  return {
    title: `${marca.nome} no Atacado`,
    description:
      marca.descricao ??
      `Produtos ${marca.nome} no atacado da Comercial Galé, em embalagens fechadas, com preço de Atacado e de Varejo. Distribuidora de moda íntima desde 1976, em São Paulo.`,
    ...(sp.ordem ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical: pagina > 1 ? `${base}?pagina=${pagina}` : base },
  };
}

export default async function PaginaMarca(props: PageProps<"/marcas/[slug]">) {
  const { slug } = await props.params;
  const sp = (await props.searchParams) as Busca;
  const marca = await marcaPorSlug(decodeURIComponent(slug));
  if (!marca) notFound();

  const trilha = [{ nome: "Marcas", href: "/marcas" }, { nome: marca.nome }];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <JsonLd dados={dadosTrilha(trilha)} />
      <Trilha itens={trilha} />

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-texto">
          {marca.nome} no atacado
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-suave">
          {marca.descricao ??
            `Todos os produtos ${marca.nome} disponíveis no catálogo da Galé.`}
        </p>
      </header>

      <Vitrine
        filtros={{
          fabricanteId: marca.id,
          ordem: (["recentes", "nome"].includes(sp.ordem ?? "")
            ? sp.ordem
            : undefined) as "recentes" | "nome" | undefined,
          pagina: Math.max(1, Number(sp.pagina) || 1),
        }}
        caminho={`/marcas/${marca.slug}`}
        parametros={{ ordem: sp.ordem }}
        semFiltroDeMarca
      />
    </div>
  );
}
