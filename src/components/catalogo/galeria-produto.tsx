"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { VisualizadorFoto } from "./visualizador-foto";

type Foto = { id: number; url: string; alt: string | null };

/**
 * Galeria da ficha do produto: foto grande + miniaturas.
 * Uma foto só? Nada de miniatura — só a imagem, limpa.
 *
 * A foto grande é um botão: clicar abre o visualizador em tela cheia, com
 * zoom (pedido do cliente — o lojista quer ver tecido, renda e etiqueta de
 * perto antes de fechar a embalagem). A lupa no cursor e o selo "Clique para
 * ampliar" avisam que dá; no celular o selo diz "Toque".
 */
export function GaleriaProduto({ fotos, titulo }: { fotos: Foto[]; titulo: string }) {
  const [ativa, setAtiva] = useState(0);
  const [ampliando, setAmpliando] = useState(false);
  // recebe o foco de volta quando o visualizador fecha
  const fotoRef = useRef<HTMLButtonElement>(null);

  if (!fotos.length) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl border border-borda bg-superficie-2 text-sm text-tenue">
        sem foto
      </div>
    );
  }

  const indice = Math.min(ativa, fotos.length - 1);
  const foto = fotos[indice];
  const descricao = foto.alt ?? titulo;

  // min-w-0: a galeria é item do grid da ficha e, no celular (coluna única
  // "auto"), o min-width:auto do item fazia a coluna esticar até caber a faixa
  // de miniaturas inteira — com 6 fotos ou mais a página passava da tela e o
  // visualizador abria cortado. Assim a faixa fica na largura da coluna e rola
  // por dentro.
  return (
    <div className="min-w-0">
      <button
        ref={fotoRef}
        type="button"
        onClick={() => setAmpliando(true)}
        aria-haspopup="dialog"
        aria-label={`Ampliar foto: ${descricao}`}
        className="group relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-2xl bg-white shadow-suave ring-1 ring-borda"
      >
        <Image
          key={foto.id}
          src={foto.url}
          alt={descricao}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 45vw"
          className="object-contain p-4"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-suave shadow-pousada ring-1 ring-borda transition group-hover:text-texto"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6" stroke="currentColor" strokeWidth="2" />
            <path d="m15 15 5 5M10.5 8v5M8 10.5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="pointer-coarse:hidden">Clique para ampliar</span>
          <span className="hidden pointer-coarse:inline">Toque para ampliar</span>
        </span>
      </button>

      {fotos.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 rolagem-fina" role="listbox" aria-label="Fotos do produto">
          {fotos.map((f, i) => (
            <button
              key={f.id}
              type="button"
              role="option"
              aria-selected={i === indice}
              aria-label={`Foto ${i + 1} de ${fotos.length}`}
              onClick={() => setAtiva(i)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white border-2 transition ${
                i === indice ? "border-gale-500" : "border-borda hover:border-borda-forte"
              }`}
            >
              {/* a miniatura da foto ativa usa a MESMA URL da foto grande (fotos
                  sem otimizador) e o next/image em dev guarda uma entrada por
                  URL: a miniatura "lazy", registrada depois, apagava a marca de
                  prioridade da foto grande e o console acusava falso aviso de
                  LCP. "eager" aqui não custa download nenhum — é o mesmo
                  arquivo que a foto grande já está baixando. */}
              <Image
                src={f.url}
                alt=""
                fill
                sizes="64px"
                loading={i === indice ? "eager" : undefined}
                className="object-contain p-1"
              />
            </button>
          ))}
        </div>
      )}

      {/* a foto que se vê no visualizador fica ativa na ficha ao fechar */}
      {ampliando && (
        <VisualizadorFoto
          fotos={fotos}
          titulo={titulo}
          indice={indice}
          aoTrocar={setAtiva}
          aoFechar={() => setAmpliando(false)}
          origem={fotoRef}
        />
      )}
    </div>
  );
}
