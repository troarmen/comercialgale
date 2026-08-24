"use client";

import Image from "next/image";
import { useState } from "react";

type Foto = { id: number; url: string; alt: string | null };

/**
 * Galeria da ficha do produto: foto grande + miniaturas.
 * Uma foto só? Nada de miniatura — só a imagem, limpa.
 */
export function GaleriaProduto({ fotos, titulo }: { fotos: Foto[]; titulo: string }) {
  const [ativa, setAtiva] = useState(0);

  if (!fotos.length) {
    return (
      <div className="flex aspect-[3/4] items-center justify-center rounded-2xl border border-borda bg-superficie-2 text-sm text-tenue">
        sem foto
      </div>
    );
  }

  const foto = fotos[Math.min(ativa, fotos.length - 1)];

  return (
    <div>
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-superficie-2 shadow-suave ring-1 ring-borda">
        <Image
          key={foto.id}
          src={foto.url}
          alt={foto.alt ?? titulo}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 45vw"
          className="object-cover"
        />
      </div>

      {fotos.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 rolagem-fina" role="listbox" aria-label="Fotos do produto">
          {fotos.map((f, i) => (
            <button
              key={f.id}
              type="button"
              role="option"
              aria-selected={i === ativa}
              aria-label={`Foto ${i + 1} de ${fotos.length}`}
              onClick={() => setAtiva(i)}
              className={`relative h-20 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                i === ativa ? "border-gale-500" : "border-borda hover:border-borda-forte"
              }`}
            >
              <Image src={f.url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
