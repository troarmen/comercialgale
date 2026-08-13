import type { Metadata } from "next";
import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { GerenciadorSubcategorias } from "./editor";

export const metadata: Metadata = { title: "Subcategorias · Galé Comercial" };

export default async function PaginaSubcategorias({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const sp = await searchParams;
  const categoriaFiltrada = sp.categoria ? Number(sp.categoria) : null;

  const supabase = await criarClienteServidor();

  const [{ data: categorias }, { data: subs }, { data: produtos }] =
    await Promise.all([
      supabase.from("categorias").select("id, nome").order("ordem").order("nome"),
      supabase
        .from("subcategorias")
        .select("id, categoria_id, nome, descricao, ordem, ativo")
        .order("categoria_id")
        .order("ordem")
        .order("nome"),
      // contagem por coluna — ver comentário em cadastros/fabricantes/page.tsx
      supabase.from("produtos").select("subcategoria_id"),
    ]);

  const conta = new Map<number, number>();
  for (const p of produtos ?? []) {
    if (p.subcategoria_id != null) {
      conta.set(p.subcategoria_id, (conta.get(p.subcategoria_id) ?? 0) + 1);
    }
  }

  const todas = (subs ?? []).map((s) => ({
    ...s,
    produtos: conta.get(s.id) ?? 0,
  }));

  const lista = categoriaFiltrada
    ? todas.filter((s) => s.categoria_id === categoriaFiltrada)
    : todas;

  const semProduto = todas.filter((s) => !s.produtos).length;

  return (
    <div className="px-8 py-7">
      <nav className="mb-3 text-sm text-suave">
        <Link href="/admin/cadastros" className="transition hover:text-texto">
          Cadastros
        </Link>
        <span className="px-1.5 text-tenue">/</span>
        <span className="text-texto">Subcategorias</span>
      </nav>

      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-texto">
          Subcategorias
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-suave">
          A divisão dentro de cada categoria. É por aqui que o cliente afunila a
          busca depois de escolher, por exemplo, Lingerie.
        </p>
      </header>

      {semProduto > 0 && !categoriaFiltrada && (
        <p className="mb-4 rounded-lg border border-borda bg-alerta-fundo px-3.5 py-2.5 text-sm text-alerta-texto">
          {semProduto} subcategorias sem nenhum produto. Quase todas são da
          Linha Praia, que está desativada — pode ser sazonal, vale confirmar
          com o Arthur antes de excluir.
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-1">
        <Link
          href="/admin/cadastros/subcategorias"
          className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm transition ${
            !categoriaFiltrada
              ? "bg-superficie font-medium text-texto shadow-sm"
              : "text-suave hover:bg-superficie hover:text-texto"
          }`}
        >
          Todas
          <span className="tabular-nums text-xs text-tenue">{todas.length}</span>
        </Link>
        {(categorias ?? []).map((c) => {
          const n = todas.filter((s) => s.categoria_id === c.id).length;
          const ativo = categoriaFiltrada === c.id;
          return (
            <Link
              key={c.id}
              href={`?categoria=${c.id}`}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm transition ${
                ativo
                  ? "bg-superficie font-medium text-texto shadow-sm"
                  : "text-suave hover:bg-superficie hover:text-texto"
              }`}
            >
              {c.nome}
              <span className="tabular-nums text-xs text-tenue">{n}</span>
            </Link>
          );
        })}
      </div>

      <GerenciadorSubcategorias
        categorias={categorias ?? []}
        lista={lista}
        categoriaFiltrada={categoriaFiltrada}
      />
    </div>
  );
}
