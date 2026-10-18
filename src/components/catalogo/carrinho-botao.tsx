"use client";

import Link from "next/link";
import { useCarrinho } from "./carrinho";

/** Atalho do carrinho no topo, com a contagem de embalagens. */
export function CarrinhoBotao() {
  const { itens, pronto } = useCarrinho();
  const total = itens.reduce((soma, i) => soma + i.qtdKits, 0);

  return (
    <Link
      href="/carrinho"
      className="relative flex h-10 items-center gap-2 rounded-full border border-borda bg-superficie px-3.5 text-sm font-medium text-texto transition hover:border-borda-forte hover:bg-superficie-2 hover:shadow-pousada"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5" aria-hidden="true">
        <path
          d="M4 5h2l2.2 10.4a1.6 1.6 0 0 0 1.57 1.27h6.9a1.6 1.6 0 0 0 1.56-1.22L20 9H7"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="10.5" cy="20" r="1.3" fill="currentColor" />
        <circle cx="16.5" cy="20" r="1.3" fill="currentColor" />
      </svg>
      <span className="hidden sm:inline">Pedido</span>
      {pronto && total > 0 && (
        <span
          aria-label={`${total} ${total === 1 ? "embalagem" : "embalagens"} no pedido`}
          className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-acento px-1 text-[11px] font-bold text-white"
        >
          {total > 99 ? "99+" : total}
        </span>
      )}
    </Link>
  );
}
