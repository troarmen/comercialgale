"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

export function BuscaPedidos() {
  const router = useRouter();
  const params = useSearchParams();
  const [, iniciar] = useTransition();
  const [termo, setTermo] = useState(params.get("busca") ?? "");
  const primeira = useRef(true);

  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    const t = setTimeout(() => {
      const novo = new URLSearchParams(params.toString());
      if (termo) novo.set("busca", termo);
      else novo.delete("busca");
      novo.delete("pagina");
      iniciar(() => router.replace(`/admin/pedidos?${novo}`, { scroll: false }));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo]);

  return (
    <div className="relative min-w-64">
      <svg
        viewBox="0 0 20 20"
        fill="none"
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tenue"
        aria-hidden="true"
      >
        <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="Buscar pelo número do pedido…"
        aria-label="Buscar pedidos"
        className="h-9 w-full rounded-lg border border-borda bg-superficie pl-8 pr-3 text-sm text-texto outline-none transition placeholder:text-tenue focus:border-gale-500"
      />
    </div>
  );
}
