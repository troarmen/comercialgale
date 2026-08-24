"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/**
 * Barra de refino da vitrine: marca e ordenação.
 * Categoria e subcategoria NÃO ficam aqui — são páginas próprias, com link,
 * porque importam para o Google e para compartilhar endereço.
 */

const CLASSE_CAMPO =
  "h-10 rounded-lg border border-borda bg-superficie px-2.5 text-sm text-texto shadow-pousada outline-none transition focus:border-gale-500";

export function FiltrosVitrine({
  marcas,
  comBusca = false,
}: {
  marcas: { id: number; nome: string }[];
  comBusca?: boolean;
}) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  const [pendente, iniciar] = useTransition();

  const marca = params.get("marca") ?? "";
  const ordem = params.get("ordem") ?? "";
  const busca = params.get("busca") ?? "";

  function aplicar(mudancas: Record<string, string>) {
    const novo = new URLSearchParams(params.toString());
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor) novo.set(chave, valor);
      else novo.delete(chave);
    }
    novo.delete("pagina");
    const texto = novo.toString();
    iniciar(() =>
      router.replace(texto ? `${caminho}?${texto}` : caminho, { scroll: false }),
    );
  }

  const temFiltro = !!(marca || ordem || (comBusca && busca));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {marcas.length > 0 && (
        <select
          value={marca}
          aria-label="Filtrar por marca"
          onChange={(e) => aplicar({ marca: e.target.value })}
          className={CLASSE_CAMPO}
        >
          <option value="">Todas as marcas</option>
          {marcas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      )}

      <select
        value={ordem}
        aria-label="Ordenar por"
        onChange={(e) => aplicar({ ordem: e.target.value })}
        className={CLASSE_CAMPO}
      >
        <option value="">Destaques</option>
        <option value="recentes">Mais recentes</option>
        <option value="nome">Nome (A–Z)</option>
      </select>

      {temFiltro && (
        <button
          type="button"
          onClick={() => iniciar(() => router.replace(caminho, { scroll: false }))}
          className="h-10 rounded-lg px-3 text-sm text-suave transition hover:bg-superficie-2 hover:text-texto"
        >
          Limpar
        </button>
      )}

      <span
        aria-live="polite"
        className={`text-xs text-tenue transition-opacity ${pendente ? "opacity-100" : "opacity-0"}`}
      >
        atualizando…
      </span>
    </div>
  );
}
