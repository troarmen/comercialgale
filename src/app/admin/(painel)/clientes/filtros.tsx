"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const CAMPO =
  "h-9 rounded-lg border border-borda bg-superficie px-2.5 text-sm text-texto outline-none transition focus:border-gale-500";

export function FiltrosClientes() {
  const router = useRouter();
  const params = useSearchParams();
  const [pendente, iniciar] = useTransition();
  const [busca, setBusca] = useState(params.get("busca") ?? "");
  const primeira = useRef(true);

  function aplicar(mudancas: Record<string, string>) {
    const novo = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(mudancas)) {
      if (v) novo.set(k, v);
      else novo.delete(k);
    }
    novo.delete("pagina");
    iniciar(() => router.replace(`/admin/clientes?${novo}`, { scroll: false }));
  }

  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    const t = setTimeout(() => aplicar({ busca }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const temFiltro = !!(
    busca ||
    params.get("status") ||
    params.get("acesso") ||
    params.get("tipo")
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-64 flex-1">
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
          placeholder="Buscar por nome, e-mail, CPF/CNPJ ou cidade…"
          aria-label="Buscar clientes"
          className={`${CAMPO} w-full pl-8`}
        />
      </div>

      <select
        value={params.get("status") ?? ""}
        aria-label="Situação"
        onChange={(e) => aplicar({ status: e.target.value })}
        className={CAMPO}
      >
        <option value="">Todas as situações</option>
        <option value="ativo">Ativos</option>
        <option value="incompleto">Cadastro incompleto</option>
        <option value="inativo">Inativos</option>
      </select>

      <select
        value={params.get("acesso") ?? ""}
        aria-label="Acesso ao catálogo"
        onChange={(e) => aplicar({ acesso: e.target.value })}
        className={CAMPO}
      >
        <option value="">Com e sem login</option>
        <option value="com">Já tem login</option>
        <option value="sem">Sem login</option>
      </select>

      <select
        value={params.get("tipo") ?? ""}
        aria-label="Tipo de pessoa"
        onChange={(e) => aplicar({ tipo: e.target.value })}
        className={CAMPO}
      >
        <option value="">Física e jurídica</option>
        <option value="fisica">Pessoa física</option>
        <option value="juridica">Pessoa jurídica</option>
      </select>

      {temFiltro && (
        <button
          type="button"
          onClick={() => {
            setBusca("");
            iniciar(() => router.replace("/admin/clientes", { scroll: false }));
          }}
          className="h-9 rounded-lg px-3 text-sm text-suave transition hover:bg-superficie hover:text-texto"
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
