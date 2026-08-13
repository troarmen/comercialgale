import type { Metadata } from "next";
import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { TIPOS } from "@/lib/tamanhos";
import { GerenciadorTamanhos } from "./editor";

export const metadata: Metadata = { title: "Tamanhos · Galé Comercial" };

export default async function PaginaTamanhos({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { tipo } = await searchParams;
  const supabase = await criarClienteServidor();

  const [{ data: tamanhos }, { data: usados }] = await Promise.all([
    supabase
      .from("tamanhos")
      .select("id, valor, tipo, ordem, ativo")
      .order("tipo")
      .order("ordem")
      .order("valor"),
    supabase.from("produto_tamanhos").select("tamanho_id"),
  ]);

  const conta = new Map<number, number>();
  for (const u of usados ?? []) {
    conta.set(u.tamanho_id, (conta.get(u.tamanho_id) ?? 0) + 1);
  }

  const todos = (tamanhos ?? []).map((t) => ({
    ...t,
    usos: conta.get(t.id) ?? 0,
  }));

  const lista = tipo ? todos.filter((t) => t.tipo === tipo) : todos;
  const porTipo = new Map<string, number>();
  for (const t of todos) porTipo.set(t.tipo, (porTipo.get(t.tipo) ?? 0) + 1);

  return (
    <div className="px-8 py-7">
      <nav className="mb-3 text-sm text-suave">
        <Link href="/admin/cadastros" className="transition hover:text-texto">
          Cadastros
        </Link>
        <span className="px-1.5 text-tenue">/</span>
        <span className="text-texto">Tamanhos</span>
      </nav>

      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-texto">
          Tamanhos
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-suave">
          A lista que aparece ao montar a grade de um produto.
        </p>
      </header>

      <div className="mb-4 rounded-lg border border-borda bg-alerta-fundo px-3.5 py-2.5 text-sm leading-relaxed text-alerta-texto">
        No sistema antigo tudo isso era um campo só chamado &quot;Tamanho&quot;,
        e por falta de lugar melhor entraram cores{" "}
        <span className="font-medium">(TU - Branco)</span> e grades fechadas{" "}
        <span className="font-medium">(4P/4M/4G)</span> junto. A classificação
        abaixo foi feita na migração e pode ser corrigida — marque vários e mude
        o tipo de uma vez.
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        <Link
          href="/admin/cadastros/tamanhos"
          className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm transition ${
            !tipo
              ? "bg-superficie font-medium text-texto shadow-sm"
              : "text-suave hover:bg-superficie hover:text-texto"
          }`}
        >
          Todos
          <span className="tabular-nums text-xs text-tenue">{todos.length}</span>
        </Link>
        {TIPOS.filter((t) => porTipo.get(t.valor)).map((t) => (
          <Link
            key={t.valor}
            href={`?tipo=${t.valor}`}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm transition ${
              tipo === t.valor
                ? "bg-superficie font-medium text-texto shadow-sm"
                : "text-suave hover:bg-superficie hover:text-texto"
            }`}
          >
            {t.nome}
            <span className="tabular-nums text-xs text-tenue">
              {porTipo.get(t.valor)}
            </span>
          </Link>
        ))}
      </div>

      <GerenciadorTamanhos lista={lista} />
    </div>
  );
}
