import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CarrosselBanners } from "@/components/catalogo/carrossel-banners";
import { CartaoProduto, GradeProdutos } from "@/components/catalogo/cartao-produto";
import { BrilhoMarca, PadraoPontos } from "@/components/catalogo/decorativos";
import { Arara3D, type PecaArara } from "@/components/catalogo/arara-3d";
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
import { bannersDaLoja } from "@/lib/vitrine";
import { aprovacaoAutomatica } from "./cadastro/servidor";

/*
 * Título e descrição medidos para caber inteiros no resultado do Google
 * (nov/2026), em Arial como o Google desenha: título com 56 caracteres e
 * 530px (o corte fica perto de 580px; o anterior tinha 715px e saía cortado)
 * e descrição com 137 caracteres e 893px (corte perto de 920px). O essencial
 * vem primeiro porque o celular mostra um pouco menos. "70 marcas" é o que o
 * catálogo tem hoje (72). `absolute` para o modelo "%s | Comercial Galé" não
 * duplicar a marca.
 */
const TITULO_HOME = "Atacado de Lingerie e Moda Íntima em SP | Comercial Galé";
const DESCRICAO_HOME =
  "Lingerie, meias, cuecas e pijamas no atacado desde 1976, na região da 25 de Março (SP). Mais de 70 marcas, com preço de Atacado e Varejo.";

export const metadata: Metadata = {
  title: { absolute: TITULO_HOME },
  description: DESCRICAO_HOME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Comercial Galé",
    locale: "pt_BR",
    url: "/",
    title: TITULO_HOME,
    description: DESCRICAO_HOME,
  },
};

/*
 * Peças da arara 3D do topo (nov/2026). Escolhidas a dedo no catálogo: as
 * três são lançamentos, de categorias diferentes (Lingerie, Pijamas,
 * Cuecas), fotografadas soltas em fundo branco — as únicas que recortam bem
 * para ficar "penduradas" — e em cores que conversam com o rosa do fundo.
 * O recorte transparente fica em public/arara/ (scripts/recortar_arara.py);
 * para trocar uma peça, gere o recorte novo e ajuste a linha aqui. Peça que
 * sair do ar some da arara sozinha.
 */
const ARARA = [
  {
    slug: "sutia-adulto-9189",
    recorte: "/arara/arara-sutia-blue-rose-9189.webp",
    largura: 584,
    altura: 600,
    escala: 90,
    cabide: "alca",
  },
  {
    slug: "camisola-feminina-02",
    recorte: "/arara/arara-camisola-desafio-02.webp",
    largura: 426,
    altura: 600,
    escala: 80,
    cabide: "alca",
  },
  {
    slug: "cueca-boxer-adulto-8520",
    recorte: "/arara/arara-cueca-dom-marco-8520.webp",
    largura: 600,
    altura: 533,
    escala: 96,
    cabide: "presilha",
  },
] as const;

/*
 * Home reorganizada no padrão de e-commerce pedido pelo cliente (out/2026):
 * banner principal enxuto → mini banners → PRODUTOS já na primeira dobra →
 * categorias → marcas → como comprar → história. Menos informação de uma vez;
 * a vitrine começa a vender antes do scroll.
 */

/*
 * O passo 2 depende do interruptor "Liberar cadastro automaticamente" do
 * painel (out/nov 2026): ligado, o lojista vê os preços assim que se cadastra.
 */
function passos(automatico: boolean) {
  return [
    {
      titulo: "Faça o seu cadastro",
      texto: "Conte quem é a sua loja e crie a sua senha. Leva menos de dois minutos.",
    },
    automatico
      ? {
          titulo: "Entre e veja os preços",
          texto: "O acesso é liberado na hora: Atacado e Varejo em todo o catálogo.",
        }
      : {
          titulo: "Aguarde a liberação",
          texto: "Nossa equipe confere e libera o seu acesso de lojista.",
        },
    {
      titulo: "Monte o pedido",
      texto: "Atacado e Varejo lado a lado, por embalagem fechada.",
    },
    {
      titulo: "Combine pagamento e envio",
      texto: "Recebemos o pedido e entramos em contato para fechar do seu jeito.",
    },
  ];
}

export default async function PaginaInicial() {
  // Banners do painel (Vitrine). Sai junto com as consultas abaixo; com um ou
  // mais ativos, o topo vira carrossel no lugar do banner padrão.
  const promessaBanners = bannersDaLoja();
  const [categorias, lancamentos, marcas, config, totalProdutos, { cliente }, liberacao] =
    await Promise.all([
      arvoreCategorias(),
      listarProdutos({ lancamentos: true, porPagina: 8, ordem: "recentes" }),
      marcasComContagem(),
      configPublica(),
      contarProdutosAtivos(),
      sessaoCatalogo(),
      aprovacaoAutomatica(),
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

  const banners = await promessaBanners;
  const comBanners = banners.length > 0;

  // Com banner do painel no topo, a arara nem é montada.
  const arara: PecaArara[] = comBanners
    ? []
    : (await Promise.all(ARARA.map((a) => produtoPorSlug(a.slug)))).flatMap((p, i) => {
        if (!p) return [];
        const a = ARARA[i];
        const marca = p.fabricantes?.nome;
        return [
          {
            href: `/produto/${p.slug}`,
            nome: `${p.titulo} ${p.modelo}${marca ? `, ${marca}` : ""}`,
            etiqueta: marca ? `${marca} · ${p.modelo}` : `Ref. ${p.modelo}`,
            recorte: a.recorte,
            largura: a.largura,
            altura: a.altura,
            escala: a.escala,
            cabide: a.cabide,
          },
        ];
      });

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
      {comBanners ? (
        /*
          Banners do painel (Vitrine). O h1 da página continua existindo, só
          que para leitor de tela e buscador: a arte do banner é imagem, e a
          página não pode ficar sem título principal.
        */
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:pt-6">
          <h1 className="sr-only">
            Lingerie, meias, cuecas e pijamas para abastecer a sua loja
          </h1>
          <CarrosselBanners banners={banners} />
        </div>
      ) : (
        /*
          Fundo rosado em CSS puro (.fundo-hero) e a arara 3D à direita — no
          celular, logo abaixo do texto. O fundo líquido que seguia o mouse
          saiu a pedido do cliente (nov/2026).
        */
        <section className="fundo-hero relative overflow-hidden border-b border-borda">
          <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 pb-6 pt-8 lg:grid-cols-[1fr_1.15fr] lg:gap-12 lg:py-12">
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

            {/* No desktop a arara recua do h1 e fica centralizada na coluna
                da direita (pedido do cliente, nov/2026). O respiro à direita
                também guarda espaço para a etiqueta da última peça, que pende
                para fora; o trilho continua saindo pela borda da tela. */}
            {arara.length > 0 && (
              <div className="lg:pl-8 lg:pr-6 xl:pl-20 xl:pr-12">
                <Arara3D pecas={arara} />
              </div>
            )}
          </div>
        </section>
      )}

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
      <section className="fundo-aurora-espelhada relative overflow-hidden border-y border-borda bg-superficie">
        <PadraoPontos tom="marca" />
        <div className="relative mx-auto max-w-7xl px-4 py-12" aria-labelledby="titulo-como-funciona">
          <h2 id="titulo-como-funciona" className="text-2xl font-bold tracking-tight text-texto">
            Como comprar no atacado da Galé
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-suave">
            O catálogo é aberto para todo mundo. Os preços aparecem para
            lojistas cadastrados
            {liberacao.ligada ? " — o acesso é liberado assim que você se cadastra" : " depois que a sua loja é aprovada"}
            . Sem cartão no site: o pagamento é combinado diretamente com a nossa
            equipe.
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
              {passos(liberacao.ligada).map((passo, i) => (
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
