"use client";

import Image from "next/image";
import Link from "next/link";

/** Erro inesperado no catálogo — dá saída em vez de tela branca. */
export default function ErroCatalogo({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <Image src="/coracao-gale.png" alt="" width={256} height={256} className="h-12 w-12 opacity-80" />
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-texto">
        Algo deu errado por aqui
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-suave">
        Já estamos de olho. Tente de novo — se continuar, chame a equipe no
        WhatsApp que a gente atende do jeito antigo.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="flex h-11 items-center rounded-full bg-acento px-6 text-sm font-semibold text-white transition hover:bg-acento-forte"
        >
          Tentar de novo
        </button>
        <Link
          href="/"
          className="text-sm font-semibold text-acento-texto transition hover:text-acento-forte"
        >
          Ir para o início
        </Link>
      </div>
    </div>
  );
}
