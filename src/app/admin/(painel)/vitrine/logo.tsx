"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { Aviso, CAMPO } from "@/components/cadastro-ui";
import { pesoLegivel } from "@/lib/imagem";
import type { LogoLoja } from "@/lib/vitrine";
import { restaurarLogo, salvarLogo } from "./acoes";
import { ALT_MAXIMO, MEDIDAS } from "./medidas";
import { prepararLogo, type ImagemPreparada } from "./preparar-imagem";

/**
 * Logo da loja. A prévia imita os três lugares onde ele aparece, nas mesmas
 * alturas da loja (cabeçalho 64 px, menu do celular 48 px, rodapé 80 px) e
 * sempre em fundo claro — a loja não tem tema escuro.
 */
export function EditorLogo({ atual }: { atual: LogoLoja }) {
  const [novo, setNovo] = useState<ImagemPreparada | null>(null);
  const [alt, setAlt] = useState(atual.padrao ? "Comercial Galé" : atual.alt);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);
  const previas = useRef<string[]>([]);

  useEffect(() => {
    const criadas = previas.current;
    return () => criadas.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const mostrado = novo
    ? { src: novo.previa, largura: novo.largura, altura: novo.altura }
    : { src: atual.src, largura: atual.largura, altura: atual.altura };
  const proporcao = mostrado.largura / mostrado.altura;

  async function escolher(arquivo: File) {
    setErro(null);
    setAviso(null);
    try {
      const pronto = await prepararLogo(arquivo, MEDIDAS.logo.largura);
      previas.current.push(pronto.previa);
      setNovo(pronto);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao processar a imagem.");
    }
  }

  function salvar() {
    setErro(null);
    setAviso(null);
    const dados = new FormData();
    dados.set("alt", alt);
    if (novo) dados.set("arquivo", novo.arquivo);
    iniciar(async () => {
      const r = await salvarLogo(dados);
      if (r.erro) setErro(r.erro);
      else {
        setNovo(null);
        setAviso("Logo salvo. Já está na loja.");
      }
    });
  }

  function voltarAoOriginal() {
    if (!confirm("Voltar ao logo original da Galé? O logo enviado é apagado.")) return;
    setErro(null);
    setAviso(null);
    iniciar(async () => {
      const r = await restaurarLogo();
      if (r.erro) setErro(r.erro);
      else {
        setNovo(null);
        setAlt("Comercial Galé");
        setAviso("Voltamos ao logo original.");
      }
    });
  }

  const podeSalvar = !!novo || (!atual.padrao && alt.trim() !== atual.alt);

  return (
    <section className="rounded-xl border border-borda bg-superficie p-5" aria-labelledby="titulo-logo">
      <h2 id="titulo-logo" className="text-sm font-semibold text-texto">
        Logo da loja
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-suave">
        Aparece no cabeçalho, no menu do celular e no rodapé. Use PNG ou WebP
        com fundo transparente; o arquivo é reduzido para {MEDIDAS.logo.largura} px
        de largura antes de subir.{" "}
        {atual.padrao ? (
          <strong className="font-medium text-texto">Hoje: logo original.</strong>
        ) : (
          <strong className="font-medium text-texto">Hoje: logo enviado pelo painel.</strong>
        )}
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <figure>
          <figcaption className="mb-1.5 text-xs font-medium uppercase tracking-wide text-tenue">
            Cabeçalho {novo && "· prévia, ainda não salvo"}
          </figcaption>
          <div className="flex max-w-3xl items-center gap-3 overflow-hidden rounded-lg border border-[#eaedf1] bg-white px-4 py-3 shadow-pousada">
            <Image
              src={mostrado.src}
              alt=""
              width={mostrado.largura}
              height={mostrado.altura}
              unoptimized
              className="h-16 w-auto max-w-[min(100%,15rem)] object-contain"
            />
            <span className="hidden h-10 flex-1 rounded-full bg-[#f2f4f6] sm:block" aria-hidden="true" />
            <span className="h-10 w-20 rounded-full border border-[#eaedf1]" aria-hidden="true" />
          </div>
        </figure>
        <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
          <figure>
            <figcaption className="mb-1.5 text-xs font-medium uppercase tracking-wide text-tenue">
              Menu do celular
            </figcaption>
            <div className="flex h-[104px] items-center overflow-hidden rounded-lg border border-[#eaedf1] bg-white px-3">
              <Image
                src={mostrado.src}
                alt=""
                width={mostrado.largura}
                height={mostrado.altura}
                unoptimized
                className="h-12 w-auto max-w-[min(100%,12rem)] object-contain"
              />
            </div>
          </figure>
          <figure>
            <figcaption className="mb-1.5 text-xs font-medium uppercase tracking-wide text-tenue">
              Rodapé
            </figcaption>
            <div className="flex h-[104px] items-center overflow-hidden rounded-lg border border-[#eaedf1] bg-white px-3">
              <Image
                src={mostrado.src}
                alt=""
                width={mostrado.largura}
                height={mostrado.altura}
                unoptimized
                className="h-20 w-auto max-w-[min(100%,16rem)] object-contain"
              />
            </div>
          </figure>
        </div>
      </div>

      {novo && (
        <p className="mt-2 text-xs text-suave">
          {novo.larguraOriginal} × {novo.alturaOriginal} px, {pesoLegivel(novo.pesoOriginal)} →{" "}
          {novo.largura} × {novo.altura} px, {pesoLegivel(novo.arquivo.size)}
        </p>
      )}
      {novo && proporcao > 4 && (
        <p className="mt-1 text-xs text-alerta-texto">
          Logo muito largo: para caber no cabeçalho do celular ele aparece
          pequeno. Um logo mais quadrado (ou em duas linhas) fica mais legível.
        </p>
      )}
      {/* JPEG não guarda transparência. Testa o ORIGINAL: o arquivo que sobe
          já foi convertido para WebP e nunca é JPEG. */}
      {novo?.tipoOriginal === "image/jpeg" && (
        <p className="mt-1 text-xs text-alerta-texto">
          Este arquivo não tem transparência: o fundo dele aparece como um
          retângulo no cabeçalho. Se puder, envie em PNG.
        </p>
      )}

      <div className="mt-4 flex max-w-md flex-col gap-1.5">
        <label htmlFor="alt-logo" className="text-sm font-medium text-texto">
          Texto alternativo do logo
        </label>
        <input
          id="alt-logo"
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          maxLength={ALT_MAXIMO}
          disabled={atual.padrao && !novo}
          className={`${CAMPO} disabled:opacity-60`}
        />
        <p className="text-xs text-tenue">
          O nome da loja como está escrito no logo, para leitores de tela.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          ref={entrada}
          id="arquivo-logo"
          type="file"
          accept="image/png,image/webp,image/jpeg"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) escolher(f);
            e.target.value = "";
          }}
          className="sr-only"
        />
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={pendente}
          className="h-10 rounded-lg border border-borda-forte px-4 text-sm font-medium text-texto transition hover:bg-superficie-2 disabled:opacity-60"
        >
          {novo ? "Escolher outro arquivo" : "Enviar logo novo"}
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={pendente || !podeSalvar}
          className="h-10 rounded-lg bg-acento px-5 text-sm font-semibold text-white transition hover:bg-acento-forte disabled:opacity-50"
        >
          {pendente ? "Salvando…" : "Salvar logo"}
        </button>
        {novo && (
          <button
            type="button"
            onClick={() => setNovo(null)}
            disabled={pendente}
            className="h-10 rounded-lg px-3 text-sm text-suave transition hover:bg-superficie-2 hover:text-texto"
          >
            Descartar prévia
          </button>
        )}
        {!atual.padrao && (
          <button
            type="button"
            onClick={voltarAoOriginal}
            disabled={pendente}
            className="ml-auto h-10 rounded-lg px-3 text-sm text-suave transition hover:bg-acento-texto/10 hover:text-acento-texto disabled:opacity-50"
          >
            Voltar ao logo original
          </button>
        )}
      </div>

      {erro && (
        <div className="mt-3">
          <Aviso mensagem={erro} />
        </div>
      )}
      {aviso && (
        <p role="status" className="mt-3 text-sm font-medium text-ok-texto">
          {aviso}
        </p>
      )}
    </section>
  );
}
