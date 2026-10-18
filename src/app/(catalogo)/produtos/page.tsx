import type { Metadata } from "next";
import { Trilha } from "@/components/catalogo/trilha";
import { Vitrine } from "@/components/catalogo/vitrine";
import { dadosTrilha, JsonLd } from "@/lib/seo";

type Busca = {
  busca?: string;
  marca?: string;
  ordem?: string;
  pagina?: string;
};

function interpretar(sp: Busca) {
  return {
    busca: sp.busca?.trim() || undefined,
    fabricanteId: Number(sp.marca) || undefined,
    ordem: (["recentes", "nome"].includes(sp.ordem ?? "")
      ? sp.ordem
      : undefined) as "recentes" | "nome" | undefined,
    pagina: Math.max(1, Number(sp.pagina) || 1),
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const { busca, pagina } = interpretar(sp);

  if (busca) {
    return {
      title: `Busca por “${busca}”`,
      description: `Resultados para “${busca}” no catálogo de atacado da Comercial Galé.`,
      // resultado de busca não deve entrar no índice; os links seguem valendo
      robots: { index: false, follow: true },
      alternates: { canonical: "/produtos" },
    };
  }

  const filtrado = !!(sp.marca || sp.ordem);
  return {
    title: "Catálogo de produtos no atacado",
    description:
      "Todos os produtos da Comercial Galé: lingerie, meias, cuecas e pijamas no atacado para lojistas. Venda em embalagens fechadas com preço de Atacado e de Varejo.",
    ...(filtrado ? { robots: { index: false, follow: true } } : {}),
    alternates: {
      canonical: pagina > 1 ? `/produtos?pagina=${pagina}` : "/produtos",
    },
  };
}

export default async function PaginaProdutos({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const sp = await searchParams;
  const filtros = interpretar(sp);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <JsonLd dados={dadosTrilha([{ nome: "Produtos" }])} />
      <Trilha itens={[{ nome: "Produtos" }]} />

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-texto">
          {filtros.busca ? (
            <>Resultados para “{filtros.busca}”</>
          ) : (
            "Catálogo de produtos"
          )}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-suave">
          {filtros.busca
            ? "A busca olha nome, referência, marca e descrição."
            : "Lingerie, meias, cuecas e pijamas em embalagens fechadas, com preço de Atacado e de Varejo."}
        </p>
      </header>

      <Vitrine
        filtros={filtros}
        caminho="/produtos"
        parametros={{ busca: filtros.busca, marca: sp.marca, ordem: sp.ordem }}
        comBusca
      />
    </div>
  );
}
