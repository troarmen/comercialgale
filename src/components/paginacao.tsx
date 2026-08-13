"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { numero } from "@/lib/formato";

/**
 * Mostra no máximo 7 botões: primeira, última, a atual e as vizinhas, com
 * reticências no meio. Com 556 produtos em 23 páginas, listar todas encheria
 * a tela sem ajudar ninguém.
 */
function janela(atual: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const paginas = new Set<number>([1, total, atual]);
  if (atual - 1 > 1) paginas.add(atual - 1);
  if (atual + 1 < total) paginas.add(atual + 1);
  if (atual <= 3) [2, 3, 4].forEach((n) => n < total && paginas.add(n));
  if (atual >= total - 2)
    [total - 1, total - 2, total - 3].forEach((n) => n > 1 && paginas.add(n));

  const ordenadas = [...paginas].sort((a, b) => a - b);
  const saida: (number | "…")[] = [];
  ordenadas.forEach((n, i) => {
    if (i > 0 && n - ordenadas[i - 1] > 1) saida.push("…");
    saida.push(n);
  });
  return saida;
}

export function Paginacao({
  pagina,
  paginas,
  total,
}: {
  pagina: number;
  paginas: number;
  total: number;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function ir(n: number) {
    const novo = new URLSearchParams(params.toString());
    if (n <= 1) novo.delete("pagina");
    else novo.set("pagina", String(n));
    router.replace(`?${novo}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const base =
    "flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm transition";

  return (
    <nav
      aria-label="Paginação"
      className="mt-4 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-xs text-suave">
        Página {numero(pagina)} de {numero(paginas)} · {numero(total)} no total
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => ir(pagina - 1)}
          disabled={pagina <= 1}
          className={`${base} text-suave hover:bg-superficie hover:text-texto disabled:pointer-events-none disabled:opacity-40`}
        >
          Anterior
        </button>

        {janela(pagina, paginas).map((n, i) =>
          n === "…" ? (
            <span key={`p${i}`} className={`${base} text-tenue`}>
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => ir(n)}
              aria-current={n === pagina ? "page" : undefined}
              className={`${base} tabular-nums ${
                n === pagina
                  ? "bg-acento font-semibold text-white"
                  : "text-suave hover:bg-superficie hover:text-texto"
              }`}
            >
              {n}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => ir(pagina + 1)}
          disabled={pagina >= paginas}
          className={`${base} text-suave hover:bg-superficie hover:text-texto disabled:pointer-events-none disabled:opacity-40`}
        >
          Próxima
        </button>
      </div>
    </nav>
  );
}
