import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CartaoProduto, GradeProdutos } from "@/components/catalogo/cartao-produto";
import {
  BrilhoMarca,
  CaixasFlutuantes,
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
  sessaoCatalogo,
} from "@/lib/catalogo";
import { CONTATO } from "@/lib/contato";
import { numero, reais, urlFoto } from "@/lib/formato";
import { linkWhatsApp } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

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
    titulo: "Veja preços e monte o pedido",
    texto: "Preço de atacado por kit, com sugestão de revenda para calcular a margem.",
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

  const [precos, fotosCategorias] = await Promise.all([
    precosPorProduto(lancamentos.produtos.map((p) => p.id)),
    Promise.all(
      categorias.map(async (c) => ({
        id: c.id,
        foto: c.imagem_path ?? (await fotoDaCategoria(c.id)),
      })),
    ),
  ]);
  const fotoDe = new Map(fotosCategorias.map((f) => [f.id, f.foto]));
  const clienteAtivo = !!cliente && cliente.status === "ativo";

  const destaqueFotos = lancamentos.produtos
    .map((p) => ({
      produto: p,
      foto: p.produto_imagens.find((i) => i.principal) ?? p.produto_imagens[0],
    }))
    .filter((d) => d.foto)
    .slice(0, 3);

  const numeros = [
    { valor: "48+", rotulo: "anos de tradição" },
    { valor: `${numero(totalProdutos)}`, rotulo: "produtos em linha" },
    { valor: `${numero(marcas.length)}`, rotulo: "marcas no catálogo" },
  ];

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden border-b border-borda bg-superficie">
        <PadraoGrade />
        <BrilhoMarca />
        <div className="hidden md:block">
          <CaixasFlutuantes />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-acento-texto">
              Super atacado de moda íntima desde {CONTATO.fundacao}
            </p>
            <h1 className="mt-3 max-w-xl text-4xl font-bold leading-tight tracking-tight text-texto sm:text-5xl">
              Lingerie, meias, cuecas e pijamas para abastecer a sua loja
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-suave">
              Volume de distribuidor, variedade de vitrine: tudo direto da{" "}
              {CONTATO.endereco.regiao}, em São Paulo. Cadastre a sua loja, veja
              os preços de atacado e monte o pedido online.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
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
              Venda em kits fechados · revenda sugerida para a sua margem
              {config.pedidoMinimo > 0 &&
                ` · pedido mínimo de ${reais(config.pedidoMinimo)}`}
            </p>

            <dl className="mt-9 grid w-fit grid-cols-3 gap-6 border-t border-borda pt-6 sm:gap-10">
              {numeros.map((n) => (
                <div key={n.rotulo}>
                  <dt className="sr-only">{n.rotulo}</dt>
                  <dd className="text-2xl font-bold tabular-nums tracking-tight text-texto sm:text-3xl">
                    {n.valor}
                  </dd>
                  <dd className="mt-0.5 text-xs text-suave">{n.rotulo}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Composição em camadas: fotos empilhadas como volumes de estoque,
              com selos flutuantes. Só no desktop — no celular o hero é texto. */}
          {destaqueFotos.length >= 3 && (
            <div className="relative hidden h-[460px] lg:block" aria-hidden="true">
              <div className="absolute left-0 top-14 w-48 -rotate-6 overflow-hidden rounded-2xl bg-white shadow-suave ring-1 ring-borda">
                <div className="relative aspect-square">
                  <Image
                    src={urlFoto(destaqueFotos[1].foto!.storage_path)!}
                    alt=""
                    fill
                    sizes="192px"
                    priority
                    className="object-contain p-2"
                  />
                </div>
              </div>

              <div className="absolute left-1/2 top-0 z-10 w-72 -translate-x-1/2 rotate-1 overflow-hidden rounded-3xl bg-white shadow-flutuante ring-1 ring-borda">
                <div className="relative aspect-square">
                  <Image
                    src={urlFoto(destaqueFotos[0].foto!.storage_path)!}
                    alt=""
                    fill
                    sizes="288px"
                    priority
                    className="object-contain p-2"
                  />
                </div>
              </div>

              <div className="absolute right-0 top-40 w-44 rotate-6 overflow-hidden rounded-2xl bg-white shadow-suave ring-1 ring-borda">
                <div className="relative aspect-square">
                  <Image
                    src={urlFoto(destaqueFotos[2].foto!.storage_path)!}
                    alt=""
                    fill
                    sizes="176px"
                    priority
                    className="object-contain p-2"
                  />
                </div>
              </div>

              <span className="flutua absolute -left-2 top-6 z-20 rounded-full bg-superficie px-3.5 py-2 text-xs font-bold text-texto shadow-flutuante">
                {numero(totalProdutos)} produtos em linha
              </span>
              <span className="flutua-lento absolute bottom-10 right-6 z-20 rounded-full bg-superficie px-3.5 py-2 text-xs font-bold text-texto shadow-flutuante">
                Kits fechados p/ revenda
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------- categorias */}
      <section className="mx-auto max-w-7xl px-4 py-14" aria-labelledby="titulo-categorias">
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
          {categorias.map((c, i) => {
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
                      // no celular o hero não tem foto — os dois primeiros
                      // cartões de categoria são o LCP provável da página
                      priority={i < 2}
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
      </section>

      {/* ------------------------------------------------------ lançamentos */}
      {lancamentos.produtos.length > 0 && (
        <section className="relative overflow-hidden border-y border-borda bg-superficie">
          <BrilhoMarca posicao="esquerda" />
          <div className="relative mx-auto max-w-7xl px-4 py-14" aria-labelledby="titulo-lancamentos">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <h2 id="titulo-lancamentos" className="text-2xl font-bold tracking-tight text-texto">
                  Lançamentos
                </h2>
                <p className="mt-1 text-sm text-suave">
                  As novidades que acabaram de chegar ao estoque.
                </p>
              </div>
              <Link
                href="/lancamentos"
                className="whitespace-nowrap text-sm font-semibold text-acento-texto transition hover:text-acento-forte"
              >
                Ver todos →
              </Link>
            </div>

            <GradeProdutos>
              {lancamentos.produtos.map((p) => (
                <CartaoProduto key={p.id} produto={p} faixa={precos.get(p.id)} />
              ))}
            </GradeProdutos>
          </div>
        </section>
      )}

      {/* ----------------------------------------------------------- marcas */}
      {marcas.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14" aria-labelledby="titulo-marcas">
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

      {/* ---------------------------------------------------- como funciona */}
      <section className="relative overflow-hidden border-y border-borda bg-superficie">
        <PadraoPontos />
        <div className="relative mx-auto max-w-7xl px-4 py-14" aria-labelledby="titulo-como-funciona">
          <h2 id="titulo-como-funciona" className="text-2xl font-bold tracking-tight text-texto">
            Como comprar no atacado da Galé
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-suave">
            O catálogo é aberto para todo mundo. O preço aparece depois que a sua
            loja é aprovada — sem cartão no site: o pagamento é combinado
            diretamente com a nossa equipe.
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
      <section className="mx-auto max-w-7xl px-4 py-14" aria-labelledby="titulo-historia">
        <div className="relative grid items-center gap-8 overflow-hidden rounded-3xl border border-borda/60 bg-superficie p-8 shadow-suave lg:grid-cols-[1.4fr_1fr] lg:p-10">
          <BrilhoMarca posicao="esquerda" />
          <div className="relative">
            <h2 id="titulo-historia" className="text-2xl font-bold tracking-tight text-texto">
              Meio século de balcão na {CONTATO.endereco.regiao}
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
