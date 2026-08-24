"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * Busca do topo. É um formulário de verdade: Enter funciona, o leitor de tela
 * anuncia, e sem JavaScript o GET para /produtos continua chegando lá.
 */
export function BuscaGlobal({ compacta = false }: { compacta?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [termo, setTermo] = useState(params.get("busca") ?? "");

  return (
    <form
      action="/produtos"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const limpo = termo.trim();
        router.push(limpo ? `/produtos?busca=${encodeURIComponent(limpo)}` : "/produtos");
      }}
      className={`relative w-full ${compacta ? "" : "max-w-xl"}`}
    >
      <input
        type="search"
        name="busca"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="Buscar por produto, referência ou marca…"
        aria-label="Buscar no catálogo"
        className="h-10 w-full rounded-full border border-borda bg-superficie pl-4 pr-11 text-sm text-texto outline-none transition placeholder:text-tenue focus:border-gale-500"
      />
      <button
        type="submit"
        aria-label="Buscar"
        className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-acento text-white transition hover:bg-acento-forte"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
          <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </form>
  );
}
