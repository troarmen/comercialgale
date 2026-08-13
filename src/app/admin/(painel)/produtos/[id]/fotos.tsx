"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { Aviso } from "@/components/cadastro-ui";
import { urlFoto } from "@/lib/formato";
import { pesoLegivel, prepararFoto } from "@/lib/imagem";
import { definirPrincipal, excluirFoto, reordenarFotos, subirFoto } from "./acoes";

export type Foto = {
  id: number;
  storage_path: string;
  principal: boolean;
  ordem: number;
};

export function Fotos({
  produtoId,
  fotos,
}: {
  produtoId: number;
  fotos: Foto[];
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(0);
  const [economia, setEconomia] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState<number | null>(null);

  async function enviar(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setErro(null);
    setEnviando(arquivos.length);

    let antes = 0;
    let depois = 0;
    for (const original of Array.from(arquivos)) {
      if (!original.type.startsWith("image/")) {
        setErro(`"${original.name}" não é uma imagem.`);
        continue;
      }
      try {
        const pronta = await prepararFoto(original);
        antes += pronta.pesoOriginal;
        depois += pronta.arquivo.size;

        const dados = new FormData();
        dados.set("produto_id", String(produtoId));
        dados.set("arquivo", pronta.arquivo);
        const r = await subirFoto(dados);
        if (r.erro) setErro(r.erro);
        URL.revokeObjectURL(pronta.previa);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao processar a imagem.");
      }
      setEnviando((n) => n - 1);
    }

    if (antes) {
      setEconomia(`${pesoLegivel(antes)} → ${pesoLegivel(depois)}`);
    }
    if (entrada.current) entrada.current.value = "";
  }

  function soltarEm(destino: number) {
    if (arrastando === null || arrastando === destino) return;
    const ordem = fotos.map((f) => f.id);
    const [movida] = ordem.splice(arrastando, 1);
    ordem.splice(destino, 0, movida);
    setArrastando(null);
    iniciar(async () => {
      await reordenarFotos(produtoId, ordem);
    });
  }

  return (
    <section className="rounded-xl border border-borda bg-superficie p-5">
      <h2 className="text-sm font-semibold text-texto">Fotos</h2>
      <p className="mt-1 mb-4 max-w-2xl text-sm leading-relaxed text-suave">
        A primeira é a que aparece na listagem do catálogo. Arraste para
        reordenar. As imagens são reduzidas e convertidas automaticamente antes
        de subir — pode mandar a foto direto do celular.
      </p>

      {fotos.length > 0 && (
        <ul className="mb-4 flex flex-wrap gap-3">
          {fotos.map((f, i) => (
            <li
              key={f.id}
              draggable
              onDragStart={() => setArrastando(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => soltarEm(i)}
              className={`group relative h-32 w-32 cursor-move overflow-hidden rounded-lg border-2 bg-superficie-2 transition ${
                f.principal ? "border-acento" : "border-borda"
              } ${arrastando === i ? "opacity-40" : ""}`}
            >
              <Image
                src={urlFoto(f.storage_path)!}
                alt=""
                fill
                sizes="128px"
                className="object-cover"
              />

              {f.principal && (
                <span className="absolute left-1 top-1 rounded bg-acento px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                  Principal
                </span>
              )}

              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/65 p-1 opacity-0 transition group-hover:opacity-100">
                {!f.principal && (
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() =>
                      iniciar(async () => {
                        const r = await definirPrincipal(f.id, produtoId);
                        setErro(r.erro ?? null);
                      })
                    }
                    className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white transition hover:bg-white/20"
                  >
                    principal
                  </button>
                )}
                <button
                  type="button"
                  disabled={pendente}
                  onClick={() => {
                    if (!confirm("Excluir esta foto?")) return;
                    iniciar(async () => {
                      const r = await excluirFoto(f.id, produtoId);
                      setErro(r.erro ?? null);
                    });
                  }}
                  className="ml-auto rounded px-1.5 py-0.5 text-[11px] font-medium text-white transition hover:bg-white/20"
                >
                  excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={entrada}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => enviar(e.target.files)}
        className="hidden"
        id={`fotos-${produtoId}`}
      />
      <label
        htmlFor={`fotos-${produtoId}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          enviar(e.dataTransfer.files);
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-borda px-4 py-6 text-center transition hover:border-acento hover:bg-superficie-2"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-tenue" aria-hidden="true">
          <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-sm font-medium text-texto">
          {enviando > 0
            ? `Enviando ${enviando}…`
            : "Clique ou arraste fotos para cá"}
        </span>
        <span className="text-xs text-tenue">
          JPG, PNG ou WebP · várias de uma vez
        </span>
      </label>

      {economia && (
        <p className="mt-2 text-xs text-ok-texto">
          Otimizado: {economia}
        </p>
      )}
      {erro && (
        <div className="mt-3">
          <Aviso mensagem={erro} />
        </div>
      )}
    </section>
  );
}
