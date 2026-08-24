import type { Metadata } from "next";
import Link from "next/link";
import { Trilha } from "@/components/catalogo/trilha";
import { marcasComContagem } from "@/lib/catalogo";
import { numero } from "@/lib/formato";
import { dadosTrilha, JsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Marcas de Moda Íntima no Atacado",
  description:
    "Todas as marcas do catálogo da Comercial Galé, incluindo as linhas exclusivas da casa. Compre por marca no atacado, direto de São Paulo.",
  alternates: { canonical: "/marcas" },
};

export default async function PaginaMarcas() {
  const marcas = await marcasComContagem();

  // Índice alfabético: agrupa pela primeira letra para dar escaneabilidade
  // aos ~70 nomes com produto.
  const grupos = new Map<string, typeof marcas>();
  for (const m of marcas) {
    const letra = m.nome[0]?.toUpperCase() ?? "#";
    const chave = /[A-Z]/.test(letra) ? letra : "#";
    grupos.set(chave, [...(grupos.get(chave) ?? []), m]);
  }
  const letras = [...grupos.keys()].sort();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <JsonLd dados={dadosTrilha([{ nome: "Marcas" }])} />
      <Trilha itens={[{ nome: "Marcas" }]} />

      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-texto">
          Compre por marca
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-suave">
          {numero(marcas.length)} marcas com produto em catálogo — das linhas
          exclusivas da Galé às que o seu cliente já conhece do balcão.
        </p>
      </header>

      <div className="space-y-8">
        {letras.map((letra) => (
          <section key={letra} aria-labelledby={`letra-${letra}`}>
            <h2
              id={`letra-${letra}`}
              className="mb-3 border-b border-borda pb-2 text-sm font-bold uppercase tracking-wider text-tenue"
            >
              {letra}
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {grupos.get(letra)!.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/marcas/${m.slug}`}
                    className="flex items-center justify-between rounded-xl border border-borda/60 bg-superficie px-4 py-3 text-sm shadow-pousada transition duration-200 hover:-translate-y-0.5 hover:border-gale-500 hover:shadow-suave"
                  >
                    <span className="font-medium text-texto">{m.nome}</span>
                    <span className="text-xs text-tenue">
                      {numero(m.produtos)}{" "}
                      {m.produtos === 1 ? "produto" : "produtos"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
