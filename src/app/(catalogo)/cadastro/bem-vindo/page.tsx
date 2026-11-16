import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CartaoProduto, GradeProdutos } from "@/components/catalogo/cartao-produto";
import {
  configPublica,
  listarProdutos,
  precosPorProduto,
  sessaoCatalogo,
} from "@/lib/catalogo";
import { CONTATO, linkWhatsApp } from "@/lib/contato";
import { reais } from "@/lib/formato";

export const metadata: Metadata = {
  title: "Boas-vindas",
  robots: { index: false, follow: false },
};

/**
 * Onde o cadastro termina: o lojista chega aqui JÁ LOGADO (a action entrou na
 * conta antes do redirect) e vê a faixa de boas-vindas em cima de uma
 * vitrine com preço — a prova de que deu certo, sem precisar procurar.
 *
 * Mora em /cadastro/bem-vindo, e não como faixa dentro de /produtos, para não
 * pôr um caso de uso de uma vez só na página mais acessada do catálogo.
 */
export default async function PaginaBemVindo() {
  const { user, cliente } = await sessaoCatalogo();
  if (!user || !cliente) redirect("/cadastro");

  const liberado = cliente.status === "ativo" && cliente.pode_ver_precos;
  const nome = cliente.nome_fantasia || cliente.nome;

  const [{ produtos }, config] = await Promise.all([
    listarProdutos({ porPagina: 8 }),
    configPublica(),
  ]);
  // A view só devolve preço para quem pode ver; para quem aguarda liberação
  // vem vazio e o cartão mostra o convite, como no resto do catálogo.
  const precos = await precosPorProduto(produtos.map((p) => p.id));

  const pontos = [
    "Venda por embalagem fechada: a página do produto mostra quantas peças vêm em cada uma.",
    config.pedidoMinimo > 0
      ? `Compras no atacado a partir de ${reais(config.pedidoMinimo)} (é uma referência: pedidos menores também fecham).`
      : null,
    "Fechou o pedido? A equipe entra em contato para combinar pagamento e envio. Nada é cobrado pelo site.",
  ].filter((p): p is string => !!p);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <section
        className={`rounded-2xl border p-6 shadow-suave sm:p-8 ${
          liberado ? "border-ok-texto/25 bg-ok-fundo" : "border-alerta-texto/25 bg-alerta-fundo"
        }`}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold tracking-tight text-texto sm:text-3xl">
              {liberado ? `Boas-vindas, ${nome}!` : `Cadastro recebido, ${nome}!`}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-texto">
              {liberado
                ? `Sua conta está criada e já está aberta neste navegador: os preços de Atacado${config.exibirVarejo ? " e Varejo" : ""} aparecem em todo o catálogo.`
                : "Sua conta está criada e já está aberta neste navegador. Os preços aparecem assim que a nossa equipe conferir os dados e liberar a sua loja — avisamos por e-mail."}{" "}
              Mandamos um e-mail para{" "}
              <strong className="break-all font-semibold">{user.email}</strong>{" "}
              com o passo a passo.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm leading-relaxed text-suave">
              {pontos.map((p) => (
                <li key={p} className="flex gap-2">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-acento" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <Link
              href="/produtos"
              className="flex h-11 items-center rounded-full bg-acento px-6 text-sm font-semibold text-white shadow-cta transition hover:bg-acento-forte"
            >
              Ver todo o catálogo
            </Link>
            {!liberado && (
              <a
                href={linkWhatsApp("Olá! Acabei de criar a minha conta pelo site e quero agilizar a liberação dos preços.")}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-acento-texto transition hover:text-acento-forte"
              >
                Agilizar pelo WhatsApp ({CONTATO.whatsapp}) →
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="mt-8 mb-4 flex items-end justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-texto">
          {liberado ? "Comece por aqui" : "Enquanto isso, conheça o catálogo"}
        </h2>
        <Link
          href="/produtos"
          className="text-sm font-semibold text-acento-texto transition hover:text-acento-forte"
        >
          Ver todos →
        </Link>
      </div>
      <GradeProdutos>
        {produtos.map((p, i) => (
          <CartaoProduto
            key={p.id}
            produto={p}
            faixa={precos.get(p.id)}
            prioridade={i < 4}
            exibirVarejo={config.exibirVarejo}
          />
        ))}
      </GradeProdutos>
    </div>
  );
}
