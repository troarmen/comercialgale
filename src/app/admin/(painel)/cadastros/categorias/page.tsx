import type { Metadata } from "next";
import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { GerenciadorCategorias } from "./editor";

export const metadata: Metadata = { title: "Categorias · Galé Comercial" };

export default async function PaginaCategorias() {
  const supabase = await criarClienteServidor();

  /*
   * Contagens vêm por coluna, não por agregado: a trava de preço revogou o
   * SELECT da tabela `produtos`, e `count(*)` exige privilégio na tabela
   * inteira. Ver o comentário longo em cadastros/fabricantes/page.tsx.
   */
  const [{ data: categorias }, { data: produtos }, { data: subs }] =
    await Promise.all([
      supabase
        .from("categorias")
        .select("id, nome, descricao, ordem, ativo")
        .order("ordem")
        .order("nome"),
      supabase.from("produtos").select("categoria_id"),
      supabase.from("subcategorias").select("categoria_id"),
    ]);

  const contaProdutos = new Map<number, number>();
  for (const p of produtos ?? []) {
    contaProdutos.set(p.categoria_id, (contaProdutos.get(p.categoria_id) ?? 0) + 1);
  }
  const contaSubs = new Map<number, number>();
  for (const s of subs ?? []) {
    contaSubs.set(s.categoria_id, (contaSubs.get(s.categoria_id) ?? 0) + 1);
  }

  const lista = (categorias ?? []).map((c) => ({
    ...c,
    produtos: contaProdutos.get(c.id) ?? 0,
    subcategorias: contaSubs.get(c.id) ?? 0,
  }));

  return (
    <div className="px-8 py-7">
      <nav className="mb-3 text-sm text-suave">
        <Link href="/admin/cadastros" className="transition hover:text-texto">
          Cadastros
        </Link>
        <span className="px-1.5 text-tenue">/</span>
        <span className="text-texto">Categorias</span>
      </nav>

      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-texto">
          Categorias
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-suave">
          A divisão principal do catálogo. A ordem definida aqui é a ordem em
          que aparecem no menu da loja.
        </p>
      </header>

      <GerenciadorCategorias lista={lista} />
    </div>
  );
}
