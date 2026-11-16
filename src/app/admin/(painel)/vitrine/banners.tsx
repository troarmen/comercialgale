"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { Aviso, BotaoCancelar, CAMPO } from "@/components/cadastro-ui";
import { pesoLegivel } from "@/lib/imagem";
import type { BannerGuardado } from "@/lib/vitrine";
import {
  alternarBanner,
  buscarProdutosParaBanner,
  excluirBanner,
  moverBanner,
  salvarBanner,
  type ProdutoParaLink,
} from "./acoes";
import { ALT_MAXIMO, MEDIDAS } from "./medidas";
import { prepararBanner, type ImagemPreparada } from "./preparar-imagem";

/** O banner como o painel recebe: o guardado + URLs e a situação do produto. */
export type BannerPainel = BannerGuardado & {
  urlComputador: string;
  urlCelular: string | null;
  produtoLink: { id: number; rotulo: string; ativo: boolean; existe: boolean } | null;
};

const BOTAO_LINHA =
  "rounded-lg px-2.5 py-1 text-sm text-suave transition hover:bg-superficie-2 hover:text-texto disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent";

function ResumoLink({ banner }: { banner: BannerPainel }) {
  const l = banner.link;
  if (!l) return <span className="text-tenue">Sem link</span>;
  if (l.tipo === "externo") {
    return (
      <span>
        Outro site (abre em nova aba):{" "}
        <span className="break-all font-mono text-[12px] text-texto">{l.href}</span>
      </span>
    );
  }
  if (l.tipo === "pagina") {
    return (
      <span>
        Página do site: <span className="break-all font-mono text-[12px] text-texto">{l.href}</span>
      </span>
    );
  }
  const p = banner.produtoLink;
  return (
    <span>
      Produto: <span className="text-texto">{p?.rotulo ?? l.rotulo}</span>
      {p && !p.ativo && (
        <span className="ml-2 rounded-full bg-alerta-fundo px-2 py-0.5 text-xs font-medium text-alerta-texto">
          {p.existe ? "produto desativado — o banner fica sem link" : "produto excluído — o banner fica sem link"}
        </span>
      )}
    </span>
  );
}

export function EditorBanners({
  banners,
  maximo,
}: {
  banners: BannerPainel[];
  maximo: number;
}) {
  const [editando, setEditando] = useState<string | "novo" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const ativos = banners.filter((b) => b.ativo);
  const comCelular = ativos.filter((b) => b.celular).length;
  const celularMisturado = comCelular > 0 && comCelular < ativos.length;

  function executar(acao: () => Promise<{ erro?: string }>) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (r.erro) setErro(r.erro);
    });
  }

  return (
    <section className="rounded-xl border border-borda bg-superficie p-5" aria-labelledby="titulo-banners">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="titulo-banners" className="text-sm font-semibold text-texto">
            Banners do topo da página inicial
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-suave">
            De 1 a {maximo} banners, passando um depois do outro a cada 6
            segundos. Cada um pode levar a uma página do site, a um produto ou a
            outro site. Sem nenhum banner ativo, a loja mostra o topo de sempre
            (o texto de boas-vindas com as fotos).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditando("novo")}
          disabled={banners.length >= maximo || editando !== null}
          title={banners.length >= maximo ? `O limite é de ${maximo} banners` : undefined}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-acento px-3.5 text-sm font-semibold text-white transition hover:bg-acento-forte disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
            <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Adicionar banner
        </button>
      </div>

      <dl className="mt-4 grid gap-3 rounded-lg bg-superficie-2 p-3.5 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium text-texto">Imagem para computador · obrigatória</dt>
          <dd className="mt-0.5 text-suave">
            {MEDIDAS.computador.rotulo}. Imagem em outra proporção é recortada
            pelo centro.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-texto">Imagem para celular · opcional</dt>
          <dd className="mt-0.5 text-suave">
            {MEDIDAS.celular.rotulo}. Sem ela, o celular mostra a do computador,
            mais baixa e com letra pequena.
          </dd>
        </div>
        <p className="text-xs text-tenue sm:col-span-2">
          Deixe textos e rostos longe das bordas. JPG, PNG ou WebP — a imagem é
          reduzida e convertida aqui mesmo antes de subir.
        </p>
      </dl>

      {celularMisturado && (
        <p className="mt-3 rounded-lg bg-alerta-fundo px-3.5 py-2.5 text-sm text-alerta-texto">
          {comCelular} de {ativos.length} banners ativos têm imagem para celular.
          No celular, os que não têm aparecem menores, com faixas brancas em
          cima e embaixo. Para ficar uniforme, envie a imagem de celular em
          todos (ou em nenhum).
        </p>
      )}

      {erro && (
        <div className="mt-3">
          <Aviso mensagem={erro} />
        </div>
      )}

      {editando === "novo" && (
        <div className="mt-4">
          <FormBanner aoFechar={() => setEditando(null)} />
        </div>
      )}

      {banners.length === 0 && editando !== "novo" ? (
        <p className="mt-4 rounded-lg border border-dashed border-borda px-4 py-8 text-center text-sm text-suave">
          Nenhum banner cadastrado — a loja está com o topo padrão.
        </p>
      ) : (
        <ol className="mt-4 flex flex-col gap-3">
          {banners.map((b, i) =>
            editando === b.id ? (
              <li key={b.id}>
                <FormBanner banner={b} aoFechar={() => setEditando(null)} />
              </li>
            ) : (
              <li
                key={b.id}
                className={`flex flex-wrap items-center gap-4 rounded-xl border border-borda p-3 ${
                  b.ativo ? "" : "opacity-70"
                }`}
              >
                <div className="flex shrink-0 items-end gap-2">
                  <div className="relative aspect-[3/1] w-56 overflow-hidden rounded-lg bg-superficie-2 ring-1 ring-borda">
                    <Image src={b.urlComputador} alt="" fill sizes="224px" className="object-cover" />
                  </div>
                  <div className="relative flex aspect-square w-[4.6rem] items-center justify-center overflow-hidden rounded-lg bg-superficie-2 ring-1 ring-borda">
                    {b.urlCelular ? (
                      <Image src={b.urlCelular} alt="" fill sizes="74px" className="object-cover" />
                    ) : (
                      <span className="px-1 text-center text-[10px] leading-tight text-tenue">
                        sem imagem de celular
                      </span>
                    )}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium break-words text-texto">
                    <span className="mr-2 text-tenue tabular-nums">{i + 1}º</span>
                    {b.alt}
                    <span
                      className={`ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 align-middle text-xs font-medium ${
                        b.ativo ? "bg-ok-fundo text-ok-texto" : "bg-tenue/15 text-suave"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${b.ativo ? "bg-ok-texto" : "bg-tenue"}`} />
                      {b.ativo ? "No ar" : "Desativado"}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-suave">
                    <ResumoLink banner={b} />
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-0.5">
                  <button
                    type="button"
                    disabled={pendente || i === 0}
                    onClick={() => executar(() => moverBanner(b.id, -1))}
                    aria-label={`Subir o banner ${i + 1}`}
                    title="Subir"
                    className={BOTAO_LINHA}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={pendente || i === banners.length - 1}
                    onClick={() => executar(() => moverBanner(b.id, 1))}
                    aria-label={`Descer o banner ${i + 1}`}
                    title="Descer"
                    className={BOTAO_LINHA}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={pendente || editando !== null}
                    onClick={() => setEditando(b.id)}
                    className={BOTAO_LINHA}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() => executar(() => alternarBanner(b.id, !b.ativo))}
                    className={BOTAO_LINHA}
                  >
                    {b.ativo ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() => {
                      if (!confirm(`Excluir o banner "${b.alt}"? As imagens são apagadas.`)) return;
                      executar(() => excluirBanner(b.id));
                    }}
                    className="rounded-lg px-2.5 py-1 text-sm text-suave transition hover:bg-acento-texto/10 hover:text-acento-texto disabled:opacity-30"
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ),
          )}
        </ol>
      )}
    </section>
  );
}

// ------------------------------------------------------------- formulário

type TipoLink = "nenhum" | "pagina" | "produto" | "externo";

const OPCOES_LINK: { valor: TipoLink; rotulo: string }[] = [
  { valor: "nenhum", rotulo: "Sem link" },
  { valor: "pagina", rotulo: "Página do site" },
  { valor: "produto", rotulo: "Produto" },
  { valor: "externo", rotulo: "Outro site" },
];

function CampoImagem({
  id,
  rotulo,
  dica,
  alvo,
  atual,
  preparada,
  aoEscolher,
  aoLimpar,
  proporcao,
  removivel,
  removida,
  aoRemover,
}: {
  id: string;
  rotulo: string;
  dica: string;
  alvo: { largura: number; altura: number };
  atual: string | null;
  preparada: ImagemPreparada | null;
  aoEscolher: (arquivo: File) => void;
  aoLimpar: () => void;
  proporcao: string;
  removivel?: boolean;
  removida?: boolean;
  aoRemover?: (remover: boolean) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const previa = preparada?.previa ?? (removida ? null : atual);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-texto">
        {rotulo}
      </label>
      <div
        className={`relative flex w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-borda bg-superficie-2 ${proporcao}`}
      >
        {previa ? (
          <Image src={previa} alt="" fill sizes="480px" unoptimized className="object-cover" />
        ) : (
          <span className="px-3 text-center text-xs text-tenue">{dica}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={entrada}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) aoEscolher(f);
            e.target.value = "";
          }}
          className="sr-only"
        />
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          className="h-8 rounded-lg border border-borda-forte px-3 text-sm font-medium text-texto transition hover:bg-superficie-2"
        >
          {previa ? "Trocar imagem" : "Escolher imagem"}
        </button>
        {preparada && (
          <button type="button" onClick={aoLimpar} className="h-8 rounded-lg px-2 text-sm text-suave transition hover:text-texto">
            Desfazer
          </button>
        )}
        {removivel && !preparada && atual && (
          <label className="flex items-center gap-1.5 text-sm text-suave">
            <input
              type="checkbox"
              checked={!!removida}
              onChange={(e) => aoRemover?.(e.target.checked)}
            />
            Remover a imagem de celular
          </label>
        )}
      </div>
      {preparada && (
        <p className="text-xs text-suave">
          {preparada.larguraOriginal} × {preparada.alturaOriginal} px,{" "}
          {pesoLegivel(preparada.pesoOriginal)} → {preparada.largura} × {preparada.altura} px,{" "}
          {pesoLegivel(preparada.arquivo.size)}
        </p>
      )}
      {preparada?.recortada && (
        <p className="text-xs text-alerta-texto">
          A imagem não estava na proporção certa e foi recortada pelo centro. Para
          escolher o enquadramento, envie já em {alvo.largura} × {alvo.altura} px.
        </p>
      )}
      {preparada?.pequena && (
        <p className="text-xs text-alerta-texto">
          A imagem é menor que o recomendado ({alvo.largura} × {alvo.altura} px) e
          pode aparecer sem nitidez em tela grande.
        </p>
      )}
    </div>
  );
}

function FormBanner({
  banner,
  aoFechar,
}: {
  banner?: BannerPainel;
  aoFechar: () => void;
}) {
  const [computador, setComputador] = useState<ImagemPreparada | null>(null);
  const [celular, setCelular] = useState<ImagemPreparada | null>(null);
  const [removerCelular, setRemoverCelular] = useState(false);
  const [alt, setAlt] = useState(banner?.alt ?? "");
  const [ativo, setAtivo] = useState(banner?.ativo ?? true);
  const [tipoLink, setTipoLink] = useState<TipoLink>(banner?.link?.tipo ?? "nenhum");
  const [pagina, setPagina] = useState(banner?.link?.tipo === "pagina" ? banner.link.href : "");
  const [externo, setExterno] = useState(banner?.link?.tipo === "externo" ? banner.link.href : "");
  const [produto, setProduto] = useState<{ id: number; rotulo: string } | null>(
    banner?.produtoLink ? { id: banner.produtoLink.id, rotulo: banner.produtoLink.rotulo } : null,
  );
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<ProdutoParaLink[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previas = useRef<string[]>([]);
  const idForm = banner?.id ?? "novo";

  // As prévias são URLs de blob: soltar a memória quando o formulário fecha.
  useEffect(() => {
    const criadas = previas.current;
    return () => {
      criadas.forEach((u) => URL.revokeObjectURL(u));
      if (espera.current) clearTimeout(espera.current);
    };
  }, []);

  async function preparar(
    arquivo: File,
    alvo: { largura: number; altura: number },
    guardar: (p: ImagemPreparada) => void,
  ) {
    setErro(null);
    setPreparando(true);
    try {
      const pronta = await prepararBanner(arquivo, alvo);
      previas.current.push(pronta.previa);
      guardar(pronta);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao processar a imagem.");
    } finally {
      setPreparando(false);
    }
  }

  function buscar(texto: string) {
    setBusca(texto);
    if (espera.current) clearTimeout(espera.current);
    if (texto.trim().length < 2) {
      setResultados(null);
      return;
    }
    espera.current = setTimeout(async () => {
      setBuscando(true);
      try {
        setResultados(await buscarProdutosParaBanner(texto));
      } finally {
        setBuscando(false);
      }
    }, 300);
  }

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    if (!banner && !computador) {
      setErro("Escolha a imagem para computador — ela é obrigatória.");
      return;
    }
    if (tipoLink === "produto" && !produto) {
      setErro("Busque e escolha o produto do link.");
      return;
    }

    const dados = new FormData();
    if (banner) dados.set("id", banner.id);
    dados.set("alt", alt);
    if (ativo) dados.set("ativo", "on");
    dados.set("link_tipo", tipoLink);
    dados.set("link_pagina", pagina);
    dados.set("link_externo", externo);
    if (produto) dados.set("link_produto_id", String(produto.id));
    if (computador) dados.set("arquivo_computador", computador.arquivo);
    if (celular) dados.set("arquivo_celular", celular.arquivo);
    if (removerCelular && !celular) dados.set("remover_celular", "on");

    iniciar(async () => {
      const r = await salvarBanner(dados);
      if (r.erro) setErro(r.erro);
      else aoFechar();
    });
  }

  return (
    <form
      onSubmit={enviar}
      aria-label={banner ? "Editar banner" : "Novo banner"}
      className="rounded-xl border-2 border-gale-500/40 bg-superficie p-4"
    >
      <h3 className="text-sm font-semibold text-texto">{banner ? "Editar banner" : "Novo banner"}</h3>

      <div className="mt-3 grid gap-4 md:grid-cols-[2fr_1fr]">
        <CampoImagem
          id={`img-computador-${idForm}`}
          rotulo="Imagem para computador *"
          dica={`Obrigatória · ${MEDIDAS.computador.rotulo}`}
          alvo={MEDIDAS.computador}
          atual={banner?.urlComputador ?? null}
          preparada={computador}
          proporcao="aspect-[3/1]"
          aoEscolher={(f) => preparar(f, MEDIDAS.computador, setComputador)}
          aoLimpar={() => setComputador(null)}
        />
        <CampoImagem
          id={`img-celular-${idForm}`}
          rotulo="Imagem para celular"
          dica={`Opcional · ${MEDIDAS.celular.rotulo}`}
          alvo={MEDIDAS.celular}
          atual={banner?.urlCelular ?? null}
          preparada={celular}
          proporcao="aspect-square max-w-52"
          aoEscolher={(f) => {
            setRemoverCelular(false);
            preparar(f, MEDIDAS.celular, setCelular);
          }}
          aoLimpar={() => setCelular(null)}
          removivel
          removida={removerCelular}
          aoRemover={setRemoverCelular}
        />
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor={`alt-${idForm}`} className="text-sm font-medium text-texto">
          Texto alternativo *
        </label>
        <input
          id={`alt-${idForm}`}
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          maxLength={ALT_MAXIMO}
          required
          placeholder="Ex.: Coleção de pijamas de inverno com preço de atacado"
          className={CAMPO}
        />
        <p className="text-xs text-tenue">
          O que o banner mostra, em uma frase. É lido para quem não enxerga a
          imagem e ajuda o Google a entender a página.
        </p>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-texto">Ao clicar no banner</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {OPCOES_LINK.map((o) => (
            <label
              key={o.valor}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gale-500 ${
                tipoLink === o.valor
                  ? "border-acento bg-acento-texto/10 font-medium text-acento-texto"
                  : "border-borda text-suave hover:bg-superficie-2"
              }`}
            >
              <input
                type="radio"
                name={`link-${idForm}`}
                value={o.valor}
                checked={tipoLink === o.valor}
                onChange={() => setTipoLink(o.valor)}
                className="sr-only"
              />
              {o.rotulo}
            </label>
          ))}
        </div>

        {tipoLink === "pagina" && (
          <div className="mt-3 flex flex-col gap-1.5">
            <label htmlFor={`pagina-${idForm}`} className="sr-only">
              Endereço da página
            </label>
            <input
              id={`pagina-${idForm}`}
              value={pagina}
              onChange={(e) => setPagina(e.target.value)}
              placeholder="/produtos/meias"
              className={`${CAMPO} max-w-md font-mono text-[13px]`}
            />
            <p className="text-xs text-tenue">
              O endereço depois de comercialgale.com.br, começando com /. Ex.:
              /produtos/lingerie, /lancamentos, /marcas/izitex.
            </p>
          </div>
        )}

        {tipoLink === "externo" && (
          <div className="mt-3 flex flex-col gap-1.5">
            <label htmlFor={`externo-${idForm}`} className="sr-only">
              Endereço do outro site
            </label>
            <input
              id={`externo-${idForm}`}
              value={externo}
              onChange={(e) => setExterno(e.target.value)}
              inputMode="url"
              placeholder="https://www.instagram.com/comercialgale"
              className={`${CAMPO} max-w-md font-mono text-[13px]`}
            />
            <p className="text-xs text-tenue">Abre em uma aba nova, para o lojista não perder a loja.</p>
          </div>
        )}

        {tipoLink === "produto" && (
          <div className="mt-3 flex max-w-md flex-col gap-2">
            {produto && (
              <p className="flex items-center justify-between gap-2 rounded-lg bg-superficie-2 px-3 py-2 text-sm text-texto">
                <span>
                  <span className="text-suave">Produto escolhido: </span>
                  {produto.rotulo}
                </span>
                <button
                  type="button"
                  onClick={() => setProduto(null)}
                  className="text-xs font-medium text-acento-texto hover:text-acento-forte"
                >
                  trocar
                </button>
              </p>
            )}
            {!produto && (
              <>
                <label htmlFor={`busca-${idForm}`} className="sr-only">
                  Buscar produto pela referência ou pelo nome
                </label>
                <input
                  id={`busca-${idForm}`}
                  type="search"
                  value={busca}
                  onChange={(e) => buscar(e.target.value)}
                  placeholder="Busque pela referência ou pelo nome"
                  autoComplete="off"
                  className={CAMPO}
                />
                {buscando && <p className="text-xs text-tenue">Buscando…</p>}
                {resultados && !buscando && resultados.length === 0 && (
                  <p className="text-xs text-tenue">Nenhum produto ativo com essa busca.</p>
                )}
                {resultados && resultados.length > 0 && (
                  <ul className="overflow-hidden rounded-lg border border-borda" aria-label="Produtos encontrados">
                    {resultados.map((p) => (
                      <li key={p.id} className="border-b border-borda last:border-0">
                        <button
                          type="button"
                          onClick={() => {
                            setProduto({ id: p.id, rotulo: `${p.modelo} — ${p.titulo}` });
                            setResultados(null);
                            setBusca("");
                          }}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-superficie-2"
                        >
                          <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded bg-white ring-1 ring-borda">
                            {p.foto && (
                              <Image src={p.foto} alt="" fill sizes="36px" className="object-contain" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-mono text-[12px] text-suave">{p.modelo}</span>
                            <span className="block truncate text-texto">{p.titulo}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </fieldset>

      <label className="mt-4 flex w-fit cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={ativo}
          onChange={(e) => setAtivo(e.target.checked)}
          className="peer sr-only"
        />
        <span className="relative h-6 w-11 rounded-full bg-borda-forte transition peer-checked:bg-acento peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gale-500">
          <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition ${ativo ? "translate-x-5" : ""}`} />
        </span>
        <span className="text-sm text-texto">No ar (aparece na loja)</span>
      </label>

      {erro && (
        <div className="mt-3">
          <Aviso mensagem={erro} />
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={salvando || preparando}
          className="h-10 rounded-lg bg-acento px-5 text-sm font-semibold text-white transition hover:bg-acento-forte disabled:opacity-60"
        >
          {salvando ? "Enviando…" : preparando ? "Preparando imagem…" : "Salvar banner"}
        </button>
        <BotaoCancelar aoClicar={aoFechar} />
      </div>
    </form>
  );
}
