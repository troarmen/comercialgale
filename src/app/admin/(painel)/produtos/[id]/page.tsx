import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotaoVoltar } from "@/components/voltar";
import { criarClienteServidor } from "@/lib/supabase/server";
import { carregarProduto } from "./dados";
import { ExcluirProduto } from "./excluir";
import { FormularioProduto } from "./formulario";
import { Fotos } from "./fotos";

export const metadata: Metadata = { title: "Produto · Galé Comercial" };

export default async function PaginaProduto({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dados = await carregarProduto(Number(id));
  if (!dados) notFound();
  const { p, grade, listas, legadoId } = dados;

  const supabase = await criarClienteServidor();
  const [{ data: fotos }, { count: emPedidos }] = await Promise.all([
    supabase
      .from("produto_imagens")
      .select("id, storage_path, principal, ordem")
      .eq("produto_id", p.id)
      .order("ordem"),
    supabase
      .from("pedido_itens")
      .select("id", { count: "exact", head: true })
      .eq("produto_id", p.id),
  ]);

  return (
    <div className="px-8 py-7">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Volta para a lista como ela estava: mesma busca, página e rolagem. */}
        <BotaoVoltar chave="produtos" padrao="/admin/produtos" rotulo="Voltar para produtos" />
        <nav className="text-sm text-suave">
          <Link href="/admin/produtos" className="transition hover:text-texto">
            Produtos
          </Link>
          <span className="px-1.5 text-tenue">/</span>
          <span className="text-texto">{p.titulo}</span>
        </nav>
      </div>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-texto">
            {p.titulo}
          </h1>
          <p className="mt-1 text-sm text-suave">
            ref. {p.modelo}
            {legadoId && ` · vindo do sistema antigo`}
            {emPedidos ? ` · em ${emPedidos} pedidos` : ""}
          </p>
        </div>
        <div className="flex items-start gap-2">
          {/* Cadastro de produto parecido: abre o formulário novo já preenchido. */}
          <Link
            href={`/admin/produtos/novo?de=${p.id}`}
            title="Abrir um cadastro novo com todos os campos deste produto"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-borda bg-superficie px-3.5 text-sm font-medium text-texto transition hover:bg-superficie-2"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
              <rect x="6.5" y="6.5" width="9" height="9" rx="1.8" stroke="currentColor" strokeWidth="1.6" />
              <path d="M13.5 4.5v-.2a1.8 1.8 0 0 0-1.8-1.8H6.3a1.8 1.8 0 0 0-1.8 1.8v5.4a1.8 1.8 0 0 0 1.8 1.8h.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Duplicar
          </Link>
          <ExcluirProduto id={p.id} emPedidos={emPedidos ?? 0} />
        </div>
      </header>

      <div className="max-w-4xl space-y-4">
        <Fotos produtoId={p.id} fotos={fotos ?? []} />

        {/* key: trocar de produto sem recarregar não pode herdar o estado do anterior */}
        <FormularioProduto key={p.id} p={p} listas={listas} grade={grade} />
      </div>
    </div>
  );
}
