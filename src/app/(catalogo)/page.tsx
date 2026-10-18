import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CartaoProduto, GradeProdutos } from "@/components/catalogo/cartao-produto";
import {
  BrilhoMarca,
  PadraoGrade,
  PadraoPontos,
} from "@/components/catalogo/decorativos";
import {
  arvoreCategorias,
  configPublica,
  contarProdutosAtivos,
  fotoDaCategoria,
  listarProdutos,
  marcasComContagem,
  precosPorProduto,
  produtoPorSlug,
  sessaoCatalogo,
} from "@/lib/catalogo";
import { CONTATO } from "@/lib/contato";
import { numero, reais, urlFoto } from "@/lib/formato";
import { linkWhatsApp } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/*
 * Home reorganizada no padrão de e-commerce pedido pelo cliente (out/2026):
 * banner principal enxuto → mini banners → PRODUTOS já na primeira dobra →
 * categorias → marcas → como comprar → história. Menos informação de uma vez;
 * a vitrine começa a vender antes do scroll.
 */

const PASSOS = [
  {
    titulo: "Faça o seu cadastro",
    texto: "Conte quem é a sua loja. Leva menos de dois minutos.",
  },
  {
    titulo: "Aguarde a liberação",
    texto: "Nossa equipe confere e libera o seu acesso de lojista.",
  },
  {
    titulo: "Veja os preços e monte o pedido",
    texto: "Atacado e Varejo lado a lado, por embalagem fechada.",
  },
  {
    titulo: "Combine pagamento e envio",
    texto: "Recebemos o pedido e entramos em contato para fechar do seu jeito.",
  },
];

export default async function PaginaInicial() {
  const [categorias, lancamentos, marcas, config, totalProdutos, { cliente }] =
    await Promise.all([
      arvoreCategorias(),
      listarProdutos({ lancamentos: true, porPagina: 8, ordem: "recentes" }),
      marcasComContagem(),
      configPublica(),
      contarProdutosAtivos(),
      sessaoCatalogo(),
    ]);

  /*
   * Prateleira da primeira dobra: lançamentos quando existem. Em produção a
   * migração não trouxe a marcação (`lancamento` = false em todo o catálogo),
   * então a prateleira cai para os destaques — nunca fica vazia.
   */
  const prateleira =
    lancamentos.produtos.length > 0
      ? { titulo: "Lançamentos", href: "/lancamentos", produtos: lancamentos.produtos }
      : {
          titulo: "Destaques do catálogo",
          href: "/produtos",
          produtos: (await listarProdutos({ porPagina: 8, ordem: "destaques" })).produtos,
        };

  const [precos, fotosCategorias] = await Promise.all([
    precosPorProduto(prateleira.produtos.map((p) => p.id)),
    Promise.all(
      categorias.map(async (c) => ({
        id: c.id,
        foto: c.imagem_path ?? (await fotoDaCategoria(c.id)),
      })),
    ),
  ]);
  const fotoDe = new Map(fotosCategorias.map((f) => [f.id, f.foto]));
  const clienteAtivo = !!cliente && cliente.status === "ativo";

  /*
   * Fotos do hero: três peças escolhidas a dedo, na ordem [centro, esquerda,
   * direita]. São produtos de fundo branco de estúdio e de categorias
   * diferentes, para o empilhamento ler como variedade de estoque. Fixo porque
   * a ordem alfabética entregava peças repetidas; o catálogo entra como rede
   * de segurança se algum destes sair do ar.
   */
  const HERO_SLUGS = [
    "tanga-adulto-3600",
    "meia-soquete-feminina-mf-302-a",
    "meia-soquete-feminina-mf-307",
  ];

  const escolhidos = (await Promise.all(HERO_SLUGS.map(produtoPorSlug)))
    .map((p) => ({ foto: p?.produto_imagens[0] }))
    .filter((d) => d.foto);

  const destaqueFotos =
    escolhidos.length >= 3
      ? escolhidos
      : (await listarProdutos({ porPagina: 12, ordem: "destaques" })).produtos
          .map((p) => ({
            foto: p.produto_imagens.find((i) => i.principal) ?? p.produto_imagens[0],
          }))
          .filter((d) => d.foto)
          .slice(0, 3);

  const minis = [
    {
      titulo: "Novidades no catálogo",
      texto: "O que acabou de chegar ao estoque da Galé.",
      href: "/produtos?ordem=recentes",
      acao: "Ver novidades",
    },
    clienteAtivo
      ? {
          titulo: "Seu acesso está liberado",
          texto: "Atacado e Varejo visíveis em todo o catálogo.",
          href: "/produtos",
          acao: "Começar o pedido",
        }
      : {
          titulo:
            config.pedidoMinimo > 0
              ? `Atacado a partir de ${reais(config.pedidoMinimo)}`
              : "Atacado para lojistas",
          texto: "Cadastre a sua loja e veja os preços de Atacado e Varejo.",
          href: "/cadastro",
          acao: "Fazer cadastro",
        },
    {
      titulo: "Compre por marca",
      texto: `${numero(marcas.length)} marcas, das linhas exclusivas às que o cliente já pede.`,
      href: "/marcas",
      acao: "Ver marcas",
    },
  ];

  return (
    <>
      {/* ------------------------------------------------- banner principal */}
      <section className="relative overflow-hidden border-b border-borda bg-superficie">
        <PadraoGrade />
        <BrilhoMarca />

        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-10 lg:grid-cols-[1.1fr_1fr] lg:py-14">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-acento-texto">
              Super atacado de moda íntima · 50 anos
            </p>
            <h1 className="mt-3 max-w-xl text-3xl font-bold leading-tight tracking-tight text-texto sm:text-5xl">
              Lingerie, meias, cuecas e pijamas para abastecer a sua loja
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-suave">
              {numero(totalProdutos)} produtos direto da {CONTATO.endereco.regiao},
              em São Paulo — com preço de Atacado e de Varejo para a sua margem.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/produtos"
                className="flex h-12 items-center rounded-full bg-acento px-6 text-sm font-semibold text-white shadow-cta transition duration-200 hover:-translate-y-0.5 hover:bg-acento-forte"
              >
                Ver catálogo
              </Link>
              {!clienteAtivo && (
                <Link
                  href="/cadastro"
                  className="flex h-12 items-center rounded-full border border-borda-forte bg-superficie px-6 text-sm font-semibold text-texto transition duration-200 hover:-translate-y-0.5 hover:border-texto hover:shadow-pousada"
                >
                  Quero comprar no atacado
                </Link>
              )}
            </div>

            <p className="mt-4 text-sm text-suave">
              Venda em embalagens fechadas
              {config.pedidoMinimo > 0 &&
                ` · compras no atacado a partir de ${reais(config.pedidoMinimo)}`}
            </p>
          </div>

          {/* Composição em camadas: fotos empilhadas como volumes de estoque.
              Só no desktop — no celular o banner é texto e a vitrine vem logo. */}
          {destaqueFotos.length >= 3 && (
            <div className="relative hidden h-[380px] lg:block" aria-hidden="true">
              <div className="absolute left-0 top-12 w-44 -rotate-6 overflow-hidden rounded-2xl bg-white shadow-suave ring-1 ring-borda">
                <div className="relative aspect-square">
                  <Image
                    src={urlFoto(destaqueFotos[1].foto!.storage_path)!}
                    alt=""
                    fill
                    sizes="176px"
                    priority
                    className="object-contain p-2"
                  />
                </div>
              </div>

              <div className="absolute left-1/2 top-0 z-10 w-60 -translate-x-1/2 rotate-1 overflow-hidden rounded-3xl bg-white shadow-flutuante ring-1 ring-borda">
                <div className="relative aspect-square">
                  <Image
                    src={urlFoto(destaqueFotos[0].foto!.storage_path)!}
                    alt=""
                    fill
                    sizes="240px"
                    priority
                    className="object-contain p-2"
                  />
                </div>
              </div>

              <div className="absolute right-0 top-32 w-40 rotate-6 overflow-hidden rounded-2xl bg-white shadow-suave ring-1 ring-borda">
                <div className="relative aspect-square">
                  <Image
                    src={urlFoto(destaqueFotos[2].foto!.storage_path)!}
                    alt=""
                    fill
                    sizes="160px"
                    priority
                    className="object-contain p-2"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ----------------------------------------------------- mini banners */}
      <section className="mx-auto max-w-7xl px-4 pt-6" aria-label="Atalhos">
        <div className="grid gap-3 sm:grid-cols-3">
          {minis.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group relative overflow-hidden rounded-2xl border border-borda/60 bg-superficie p-5 shadow-pousada transition duration-200 hover:-translate-y-0.5 hover:shadow-suave"
            >
              <span
                aria-hidden="true"
                className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gale-500/8 blur-xl transition group-hover:bg-gale-500/14"
              />
              <p className="text-sm font-bold text-texto">{m.titulo}</p>
              <p className="mt-1 text-xs leading-relaxed text-suave">{m.texto}</p>
              <span className="mt-3 inline-block text-xs font-semibold text-acento-texto transition group-hover:text-acento-forte">
                {m.acao} →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* -------------------------------------------- produtos na 1ª dobra */}
      {prateleira.produtos.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-10" aria-labelledby="titulo-prateleira">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 id="titulo-prateleira" className="text-2xl font-bold tracking-tight text-texto">
                {prateleira.titulo}
              </h2>
              <p className="mt-1 text-sm text-suave">
                {clienteAtivo
                  ? "Preço por embalagem fechada — Atacado e Varejo lado a lado."
                  : "Preço por embalagem fechada — Atacado e Varejo no login."}
              </p>
            </div>
            <Link
              href={prateleira.href}
              className="whitespace-nowrap text-sm font-semibold text-acento-texto transition hover:text-acento-forte"
            >
              Ver todos →
            </Link>
          </div>

          <GradeProdutos>
            {prateleira.produtos.map((p, i) => (
              <CartaoProduto
                key={p.id}
                produto={p}
                faixa={precos.get(p.id)}
                prioridade={i < 4}
                exibirVarejo={config.exibirVarejo}
              />
            ))}
          </GradeProdutos>
        </section>
      )}

      {/* ------------------------------------------------------- categorias */}
      <section className="border-y border-borda bg-superficie">
        <div className="mx-auto max-w-7xl px-4 py-10" aria-labelledby="titulo-categorias">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 id="titulo-categorias" className="text-2xl font-bold tracking-tight text-texto">
                Navegue por categoria
              </h2>
              <p className="mt-1 text-sm text-suave">
                Tudo organizado como a sua loja compra.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
            {categorias.map((c) => {
              const foto = fotoDe.get(c.id);
              return (
                <Link
                  key={c.id}
                  href={`/produtos/${c.slug}`}
                  className="group overflow-hidden rounded-2xl border border-borda/60 bg-superficie shadow-pousada transition duration-200 ease-out hover:-translate-y-1 hover:shadow-flutuante"
                >
                  <div className="relative aspect-square overflow-hidden bg-white">
                    {foto && (
                      <Image
                        src={urlFoto(foto)!}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 50vw, 20vw"
                        className="object-contain p-3 transition duration-300 group-hover:scale-[1.02]"
                      />
                    )}
                  </div>
                  <div className="p-3.5">
                    <h3 className="text-sm font-semibold text-texto group-hover:text-acento-texto">
                      {c.nome}
                    </h3>
                    {c.subcategorias.length > 0 && (
                      <p className="mt-0.5 text-xs text-suave">
                        {c.subcategorias.length}{" "}
                        {c.subcategorias.length === 1 ? "linha" : "linhas"}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- marcas */}
      {marcas.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-10" aria-labelledby="titulo-marcas">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 id="titulo-marcas" className="text-2xl font-bold tracking-tight text-texto">
                Compre por marca
              </h2>
              <p className="mt-1 text-sm text-suave">
                Das linhas exclusivas da Galé às marcas que o seu cliente já pede.
              </p>
            </div>
            <Link
              href="/marcas"
              className="whitespace-nowrap text-sm font-semibold text-acento-texto transition hover:text-acento-forte"
            >
              Todas as marcas →
            </Link>
          </div>

          <div className="flex flex-wrap gap-2">
            {marcas.slice(0, 12).map((m) => (
              <Link
                key={m.id}
                href={`/marcas/${m.slug}`}
                className="rounded-full border border-borda bg-superficie px-4 py-2 text-sm font-medium text-texto shadow-pousada transition duration-200 hover:-translate-y-0.5 hover:border-gale-500 hover:text-acento-texto hover:shadow-suave"
              >
                {m.nome}
                <span className="ml-1.5 text-xs text-tenue">{m.produtos}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------- como comprar */}
      <section className="relative overflow-hidden border-y border-borda bg-superficie">
        <PadraoPontos />
        <div className="relative mx-auto max-w-7xl px-4 py-12" aria-labelledby="titulo-como-funciona">
          <h2 id="titulo-como-funciona" className="text-2xl font-bold tracking-tight text-texto">
            Como comprar no atacado da Galé
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-suave">
            O catálogo é aberto para todo mundo. Os preços aparecem depois que a
            sua loja é aprovada — sem cartão no site: o pagamento é combinado
            diretamente com a nossa equipe.
            {config.pedidoMinimo > 0 &&
              ` Compras no atacado são a partir de ${reais(config.pedidoMinimo)}.`}
          </p>

          <div className="relative mt-8">
            {/* linha de fluxo ligando as etapas, visível só nos vãos */}
            <span
              aria-hidden="true"
              className="absolute left-[10%] right-[10%] top-9 hidden border-t-2 border-dashed border-borda-forte lg:block"
            />
            <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PASSOS.map((passo, i) => (
                <li
                  key={i}
                  className="rounded-2xl border border-borda/60 bg-fundo p-5 shadow-pousada transition duration-200 hover:-translate-y-0.5 hover:shadow-suave"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-acento text-sm font-bold text-white shadow-cta">
                    {i + 1}
                  </span>
                  <h3 className="mt-3 text-sm font-semibold text-texto">
                    {passo.titulo}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-suave">
                    {passo.texto}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          {!clienteAtivo && (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/cadastro"
                className="flex h-11 items-center rounded-full bg-acento px-6 text-sm font-semibold text-white shadow-cta transition duration-200 hover:-translate-y-0.5 hover:bg-acento-forte"
              >
                Fazer meu cadastro
              </Link>
              <Link
                href="/entrar"
                className="text-sm font-semibold text-acento-texto transition hover:text-acento-forte"
              >
                Já sou cliente
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------ instituição */}
      <section className="mx-auto max-w-7xl px-4 py-12" aria-labelledby="titulo-historia">
        <div className="relative grid items-center gap-8 overflow-hidden rounded-3xl border border-borda/60 bg-superficie p-8 shadow-suave lg:grid-cols-[1.4fr_1fr] lg:p-10">
          <BrilhoMarca posicao="esquerda" />
          <div className="relative">
            <h2 id="titulo-historia" className="text-2xl font-bold tracking-tight text-texto">
              50 anos de balcão na {CONTATO.endereco.regiao}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-suave">
              A Comercial Galé nasceu em {CONTATO.fundacao} no mercado atacadista
              do centro de São Paulo e se especializou em lingerie, meias, cuecas
              e artigos infantis. Hoje desenvolve linhas exclusivas e atende
              lojistas de todo o Brasil.
            </p>
            <Link
              href="/empresa"
              className="mt-5 inline-block text-sm font-semibold text-acento-texto transition hover:text-acento-forte"
            >
              Conheça a nossa história →
            </Link>
          </div>
          <address className="relative rounded-2xl bg-fundo p-5 text-sm not-italic leading-relaxed text-suave shadow-pousada">
            <p className="font-semibold text-texto">{CONTATO.endereco.logradouro}</p>
            <p>
              {CONTATO.endereco.bairro} — {CONTATO.endereco.cidade}/{CONTATO.endereco.uf}
            </p>
            <p className="mt-2">{CONTATO.horario}</p>
            <a
              href={linkWhatsApp()}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 font-semibold text-acento-texto transition hover:text-acento-forte"
            >
              Falar no WhatsApp →
            </a>
          </address>
        </div>
      </section>
    </>
  );
}
