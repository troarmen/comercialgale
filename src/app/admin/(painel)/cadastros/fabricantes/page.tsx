import type { Metadata } from "next";
import Link from "next/link";
import { numero } from "@/lib/formato";
import { criarClienteServidor } from "@/lib/supabase/server";
import { GerenciadorFabricantes } from "./editor";

export const metadata: Metadata = { title: "Fabricantes · Galé Comercial" };

export default async function PaginaFabricantes({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro } = await searchParams;
  const supabase = await criarClienteServidor();

  /*
   * A contagem de produtos por fabricante NÃO pode sair de `produtos(count)`.
   * A trava de preço revogou o SELECT da tabela `produtos` e reconcedeu coluna
   * a coluna — e `count(*)` exige privilégio na tabela inteira, então o
   * agregado devolve 403. Buscamos só a coluna `fabricante_id` (que está
   * liberada) e somamos aqui. São 556 linhas de uma coluna: mais barato do que
   * parece, e a alternativa seria reabrir o preço.
   */
  const [{ data }, { data: vinculos }] = await Promise.all([
    supabase.from("fabricantes").select("id, nome, descricao, ativo").order("nome"),
    supabase.from("produtos").select("fabricante_id"),
  ]);

  const usos = new Map<number, number>();
  for (const p of vinculos ?? []) {
    if (p.fabricante_id != null) {
      usos.set(p.fabricante_id, (usos.get(p.fabricante_id) ?? 0) + 1);
    }
  }

  const todos = (data ?? []).map((f) => ({ ...f, usos: usos.get(f.id) ?? 0 }));
  const semProduto = todos.filter((f) => !f.usos);

  const lista =
    filtro === "sem-produto"
      ? semProduto
      : filtro === "inativos"
        ? todos.filter((f) => !f.ativo)
        : todos;

  const abas = [
    { chave: "", nome: "Todos", total: todos.length },
    { chave: "sem-produto", nome: "Sem produto", total: semProduto.length },
    {
      chave: "inativos",
      nome: "Fora do catálogo",
      total: todos.filter((f) => !f.ativo).length,
    },
  ];

  return (
    <div className="px-8 py-7">
      <nav className="mb-3 text-sm text-suave">
        <Link href="/admin/cadastros" className="transition hover:text-texto">
          Cadastros
        </Link>
        <span className="px-1.5 text-tenue">/</span>
        <span className="text-texto">Fabricantes</span>
      </nav>

      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-texto">
          Fabricantes
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-suave">
          As marcas que a Galé revende. O cliente filtra o catálogo por elas, e
          quem está fora do catálogo não aparece no filtro da loja — mas os
          produtos continuam no ar.
        </p>
      </header>

      {semProduto.length > 0 && filtro !== "sem-produto" && (
        <p className="mb-4 rounded-lg border border-borda bg-alerta-fundo px-3.5 py-2.5 text-sm text-alerta-texto">
          {numero(semProduto.length)} fabricantes não têm nenhum produto
          cadastrado. Vieram assim do sistema antigo e podem ser excluídos sem
          afetar nada.
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-1">
        {abas.map((a) => {
          const ativo = (filtro ?? "") === a.chave;
          return (
            <Link
              key={a.chave || "todos"}
              href={a.chave ? `?filtro=${a.chave}` : "/admin/cadastros/fabricantes"}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm transition ${
                ativo
                  ? "bg-superficie font-medium text-texto shadow-sm"
                  : "text-suave hover:bg-superficie hover:text-texto"
              }`}
            >
              {a.nome}
              <span className="tabular-nums text-xs text-tenue">{a.total}</span>
            </Link>
          );
        })}
      </div>

      <GerenciadorFabricantes lista={lista} />
    </div>
  );
}
