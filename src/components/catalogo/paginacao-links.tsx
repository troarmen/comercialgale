import Link from "next/link";
import { numero } from "@/lib/formato";

/**
 * Paginação da vitrine com LINKS de verdade (não botões): o Google segue,
 * o botão do meio do mouse abre em outra aba, e sem JavaScript funciona.
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

export function PaginacaoLinks({
  pagina,
  paginas,
  total,
  caminho,
  parametros,
}: {
  pagina: number;
  paginas: number;
  total: number;
  /** rota base, ex. `/produtos/lingerie` */
  caminho: string;
  /** filtros vigentes, preservados de página em página */
  parametros?: Record<string, string | undefined>;
}) {
  if (paginas <= 1) return null;

  function href(n: number) {
    const query = new URLSearchParams();
    for (const [chave, valor] of Object.entries(parametros ?? {})) {
      if (valor) query.set(chave, valor);
    }
    if (n > 1) query.set("pagina", String(n));
    const texto = query.toString();
    return texto ? `${caminho}?${texto}` : caminho;
  }

  const base =
    "flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-sm transition";

  return (
    <nav
      aria-label="Paginação"
      className="mt-8 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-xs text-suave">
        Página {numero(pagina)} de {numero(paginas)} · {numero(total)} produtos
      </p>

      <div className="flex items-center gap-1">
        {pagina > 1 ? (
          <Link rel="prev" href={href(pagina - 1)} className={`${base} text-suave hover:bg-superficie hover:text-texto`}>
            Anterior
          </Link>
        ) : (
          <span className={`${base} pointer-events-none text-tenue opacity-50`}>Anterior</span>
        )}

        {janela(pagina, paginas).map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className={`${base} pointer-events-none text-tenue`}>
              …
            </span>
          ) : (
            <Link
              key={n}
              href={href(n)}
              aria-current={n === pagina ? "page" : undefined}
              className={`${base} ${
                n === pagina
                  ? "bg-acento font-semibold text-white"
                  : "text-suave hover:bg-superficie hover:text-texto"
              }`}
            >
              {numero(n)}
            </Link>
          ),
        )}

        {pagina < paginas ? (
          <Link rel="next" href={href(pagina + 1)} className={`${base} text-suave hover:bg-superficie hover:text-texto`}>
            Próxima
          </Link>
        ) : (
          <span className={`${base} pointer-events-none text-tenue opacity-50`}>Próxima</span>
        )}
      </div>
    </nav>
  );
}
