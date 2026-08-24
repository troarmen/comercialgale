import type { Metadata } from "next";
import { Trilha } from "@/components/catalogo/trilha";
import { CONTATO } from "@/lib/contato";
import { dadosContato, dadosTrilha, JsonLd, linkWhatsApp } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contato e Como Chegar",
  description:
    "Fale com a Comercial Galé: WhatsApp, telefone e e-mail. Loja na Avenida Prestes Maia, 454 — Centro de São Paulo, de segunda a sexta, das 07h às 17h.",
  alternates: { canonical: "/contato" },
};

const CANAIS = [
  {
    nome: "WhatsApp",
    valor: CONTATO.whatsapp,
    href: linkWhatsApp(),
    externo: true,
    detalhe: "Resposta mais rápida em horário comercial",
  },
  {
    nome: "Telefone",
    valor: CONTATO.telefoneFixo,
    href: `tel:+55${CONTATO.telefoneFixo.replace(/\D/g, "")}`,
    externo: false,
    detalhe: CONTATO.horario,
  },
  {
    nome: "E-mail",
    valor: CONTATO.email,
    href: `mailto:${CONTATO.email}`,
    externo: false,
    detalhe: "Para orçamentos e dúvidas de cadastro",
  },
];

export default function PaginaContato() {
  const enderecoCompleto = `${CONTATO.endereco.logradouro}, ${CONTATO.endereco.bairro}, ${CONTATO.endereco.cidade} - ${CONTATO.endereco.uf}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <JsonLd dados={[dadosTrilha([{ nome: "Contato" }]), dadosContato()]} />
      <Trilha itens={[{ nome: "Contato" }]} />

      <h1 className="text-3xl font-bold tracking-tight text-texto">
        Fale com a Galé
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-suave">
        Dúvida sobre produto, cadastro ou um pedido já fechado? A equipe atende
        de {CONTATO.horario.toLowerCase()}.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {CANAIS.map((c) => (
          <a
            key={c.nome}
            href={c.href}
            {...(c.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="rounded-2xl border border-borda bg-superficie p-5 shadow-pousada transition duration-200 hover:-translate-y-1 hover:border-gale-500 hover:shadow-flutuante"
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider text-tenue">
              {c.nome}
            </h2>
            <p className="mt-1.5 break-all text-base font-semibold text-acento-texto">
              {c.valor}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-suave">{c.detalhe}</p>
          </a>
        ))}
      </div>

      <div className="mt-8 grid gap-6 rounded-2xl border border-borda bg-superficie p-6 sm:grid-cols-2 sm:p-8">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-texto">
            Visite a loja
          </h2>
          <address className="mt-2 text-sm not-italic leading-relaxed text-suave">
            {CONTATO.endereco.logradouro}
            <br />
            {CONTATO.endereco.bairro} — {CONTATO.endereco.cidade}/{CONTATO.endereco.uf}
            <br />
            Na {CONTATO.endereco.regiao}
          </address>
          <p className="mt-3 text-sm text-suave">{CONTATO.horario}</p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex h-10 items-center rounded-full border border-borda px-5 text-sm font-semibold text-texto transition hover:border-borda-forte"
          >
            Ver no mapa →
          </a>
        </div>
        <div className="rounded-xl bg-superficie-2 p-5">
          <h2 className="text-sm font-semibold text-texto">
            Quer comprar no atacado?
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-suave">
            O caminho mais curto é o cadastro online: a equipe confere, libera o
            acesso e você compra com preço de lojista pelo próprio site.
          </p>
          <a
            href="/cadastro"
            className="mt-4 inline-flex h-10 items-center rounded-full bg-acento px-5 text-sm font-semibold text-white transition hover:bg-acento-forte"
          >
            Cadastrar minha loja
          </a>
        </div>
      </div>
    </div>
  );
}
