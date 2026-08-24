import type { Metadata } from "next";
import Link from "next/link";
import { Trilha } from "@/components/catalogo/trilha";
import { CONTATO } from "@/lib/contato";
import { dadosTrilha, JsonLd, linkWhatsApp } from "@/lib/seo";

export const metadata: Metadata = {
  title: "A Comercial Galé — Atacadista de Moda Íntima desde 1976",
  description:
    "Fundada em 1976 na região da 25 de Março, em São Paulo, a Comercial Galé é especializada em lingerie, meias, cuecas e pijamas no atacado, com linhas exclusivas próprias.",
  alternates: { canonical: "/empresa" },
};

const MARCOS = [
  {
    ano: "1976",
    texto:
      "Em 7 de abril, dois jovens ingressam no mercado atacadista da concorrida região da 25 de Março e fundam a Comercial Galé de Confecções Ltda., especializada em lingerie — na época um ramo ainda pouco explorado — além de meias, cuecas e artigos infantis.",
  },
  {
    ano: "1990",
    texto:
      "A Galé passa a desenvolver e importar linhas exclusivas de produtos, dando origem às marcas próprias Bruna Lian, Artbrun e Arth's Lian.",
  },
  {
    ano: "2016",
    texto:
      "Devido à grande procura, a casa passa a atender também o público do varejo, sem abandonar a vocação atacadista.",
  },
  {
    ano: "Hoje",
    texto:
      "Meio século de balcão depois, a Galé segue no mesmo endereço do Centro de São Paulo, atendendo lojistas de todo o Brasil com variedade, qualidade e preço baixo — agora também pelo catálogo online.",
  },
];

export default function PaginaEmpresa() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <JsonLd dados={dadosTrilha([{ nome: "A Galé" }])} />
      <Trilha itens={[{ nome: "A Galé" }]} />

      <h1 className="text-3xl font-bold tracking-tight text-texto">
        Meio século vendendo moda íntima no atacado
      </h1>
      <p className="mt-3 text-base leading-relaxed text-suave">
        A Comercial Galé nasceu do balcão: grandes parcerias que permanecem até
        hoje, atenção constante ao que o mercado pede e o compromisso de sempre
        oferecer variedade e preço baixo para quem revende.
      </p>

      <ol className="mt-10 space-y-8 border-l-2 border-borda pl-6">
        {MARCOS.map((m) => (
          <li key={m.ano} className="relative">
            <span
              className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-gale-500 bg-superficie"
              aria-hidden="true"
            />
            <h2 className="text-lg font-bold text-texto">{m.ano}</h2>
            <p className="mt-1 text-sm leading-relaxed text-suave">{m.texto}</p>
          </li>
        ))}
      </ol>

      <div className="mt-12 rounded-2xl border border-borda/60 bg-superficie p-6 shadow-suave">
        <h2 className="text-lg font-bold tracking-tight text-texto">
          Obrigado por escrever essa história com a gente
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-suave">
          Aos fornecedores, clientes, representantes e funcionários que nos
          ajudam diariamente: esperamos continuar contando sempre com vocês.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/cadastro"
            className="flex h-11 items-center rounded-full bg-acento px-6 text-sm font-semibold text-white transition hover:bg-acento-forte"
          >
            Comprar no atacado
          </Link>
          <a
            href={linkWhatsApp()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-acento-texto transition hover:text-acento-forte"
          >
            Falar com a equipe →
          </a>
        </div>
      </div>

      <p className="mt-8 text-sm text-suave">
        Estamos na {CONTATO.endereco.logradouro}, {CONTATO.endereco.bairro} —{" "}
        {CONTATO.endereco.cidade}/{CONTATO.endereco.uf} · {CONTATO.horario}.{" "}
        <Link href="/contato" className="font-semibold text-acento-texto">
          Veja como chegar
        </Link>
        .
      </p>
    </div>
  );
}
