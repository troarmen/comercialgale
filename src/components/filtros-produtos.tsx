"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

type Opcao = { id: number; nome: string; categoria_id?: number | null };

const CLASSE_CAMPO =
  "h-9 rounded-lg border border-borda bg-superficie px-2.5 text-sm text-texto outline-none transition focus:border-gale-500";

export function FiltrosProdutos({
  categorias,
  subcategorias,
  fabricantes,
}: {
  categorias: Opcao[];
  subcategorias: Opcao[];
  fabricantes: Opcao[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pendente, iniciar] = useTransition();

  const [busca, setBusca] = useState(params.get("busca") ?? "");
  const primeiraRenderizacao = useRef(true);

  const categoria = params.get("categoria") ?? "";
  const subcategoria = params.get("subcategoria") ?? "";
  const fabricante = params.get("fabricante") ?? "";
  const status = params.get("status") ?? "";

  function aplicar(mudancas: Record<string, string>) {
    const novo = new URLSearchParams(params.toString());
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor) novo.set(chave, valor);
      else novo.delete(chave);
    }
    // qualquer mudança de filtro volta para a primeira página
    novo.delete("pagina");
    iniciar(() => router.replace(`/admin/produtos?${novo}`, { scroll: false }));
  }

  // Espera a digitação parar antes de consultar. Sem isso, "calcinha" dispara
  // oito buscas no banco.
  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    const t = setTimeout(() => aplicar({ busca }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  // Só mostra as subcategorias da categoria escolhida — são 38 no total, e a
  // lista inteira num seletor só seria inútil.
  const subsVisiveis = categoria
    ? subcategorias.filter((s) => String(s.categoria_id) === categoria)
    : subcategorias;

  const temFiltro = !!(busca || categoria || subcategoria || fabricante || status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-56 flex-1">
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
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, referência ou tag…"
          aria-label="Buscar produtos"
          className={`${CLASSE_CAMPO} w-full pl-8`}
        />
      </div>

      <select
        value={categoria}
        aria-label="Categoria"
        onChange={(e) => aplicar({ categoria: e.target.value, subcategoria: "" })}
        className={CLASSE_CAMPO}
      >
        <option value="">Todas as categorias</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>{c.nome}</option>
        ))}
      </select>

      <select
        value={subcategoria}
        aria-label="Subcategoria"
        onChange={(e) => aplicar({ subcategoria: e.target.value })}
        className={CLASSE_CAMPO}
      >
        <option value="">Todas as subcategorias</option>
        {subsVisiveis.map((s) => (
          <option key={s.id} value={s.id}>{s.nome}</option>
        ))}
      </select>

      <select
        value={fabricante}
        aria-label="Fabricante"
        onChange={(e) => aplicar({ fabricante: e.target.value })}
        className={CLASSE_CAMPO}
      >
        <option value="">Todos os fabricantes</option>
        {fabricantes.map((f) => (
          <option key={f.id} value={f.id}>{f.nome}</option>
        ))}
      </select>

      <select
        value={status}
        aria-label="Situação"
        onChange={(e) => aplicar({ status: e.target.value })}
        className={CLASSE_CAMPO}
      >
        <option value="">Ativos e desativados</option>
        <option value="ativo">Só ativos</option>
        <option value="inativo">Só desativados</option>
      </select>

      {temFiltro && (
        <button
          type="button"
          onClick={() => {
            setBusca("");
            iniciar(() => router.replace("/admin/produtos", { scroll: false }));
          }}
          className="h-9 rounded-lg px-3 text-sm text-suave transition hover:bg-superficie-2 hover:text-texto"
        >
          Limpar
        </button>
      )}

      <span
        aria-live="polite"
        className={`text-xs text-tenue transition-opacity ${pendente ? "opacity-100" : "opacity-0"}`}
      >
        buscando…
      </span>
    </div>
  );
}
