import type { Metadata } from "next";
import { Trilha } from "@/components/catalogo/trilha";
import { Vitrine } from "@/components/catalogo/vitrine";
import { dadosTrilha, JsonLd } from "@/lib/seo";

type Busca = { marca?: string; ordem?: string; pagina?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  return {
    title: "Lançamentos de Moda Íntima no Atacado",
    description:
      "As novidades do atacado da Comercial Galé: os últimos lançamentos em lingerie, meias, cuecas e pijamas para renovar a vitrine da sua loja.",
    ...(sp.marca || sp.ordem ? { robots: { index: false, follow: true } } : {}),
    alternates: {
      canonical: pagina > 1 ? `/lancamentos?pagina=${pagina}` : "/lancamentos",
    },
  };
}

export default async function PaginaLancamentos({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const sp = await searchParams;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <JsonLd dados={dadosTrilha([{ nome: "Lançamentos" }])} />
      <Trilha itens={[{ nome: "Lançamentos" }]} />

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-texto">
          Lançamentos
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-suave">
          O que acabou de chegar ao estoque da Galé — renove a vitrine antes da
          concorrência.
        </p>
      </header>

      <Vitrine
        filtros={{
          lancamentos: true,
          fabricanteId: Number(sp.marca) || undefined,
          ordem: (["recentes", "nome"].includes(sp.ordem ?? "")
            ? sp.ordem
            : "recentes") as "recentes" | "nome",
          pagina: Math.max(1, Number(sp.pagina) || 1),
        }}
        caminho="/lancamentos"
        parametros={{ marca: sp.marca, ordem: sp.ordem }}
      />
    </div>
  );
}
