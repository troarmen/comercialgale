import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { numero, reais } from "@/lib/formato";
import { STATUS, dataCurta } from "@/lib/pedidos";
import { criarClienteServidor } from "@/lib/supabase/server";
import { GerenciarAcesso } from "./acesso";
import { salvarCliente } from "./acoes";
import { FormularioCliente } from "./formulario";

export const metadata: Metadata = { title: "Cliente · Galé Comercial" };

export default async function PaginaCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await criarClienteServidor();

  const { data: cliente } = await supabase
    .from("clientes")
    .select(
      `id, nome, nome_fantasia, tipo_pessoa, status, documento, inscricao_estadual,
       rg, email, telefone1, telefone2, nome_contato, cep, logradouro, numero,
       complemento, bairro, cidade, uf, observacoes, pode_ver_precos, user_id,
       cliente_antigo, cadastrado_em`,
    )
    .eq("id", Number(id))
    .maybeSingle();

  if (!cliente) notFound();

  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("id, numero, status, total_atacado, total_pecas, criado_em")
    .eq("cliente_id", cliente.id)
    .order("criado_em", { ascending: false })
    .limit(10);

  const { count: totalPedidos } = await supabase
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", cliente.id);

  const gastoTotal = (pedidos ?? []).reduce(
    (s, p) => s + Number(p.total_atacado ?? 0),
    0,
  );

  return (
    <div className="px-8 py-7">
      <nav className="mb-3 text-sm text-suave">
        <Link href="/admin/clientes" className="transition hover:text-texto">
          Clientes
        </Link>
        <span className="px-1.5 text-tenue">/</span>
        <span className="text-texto">{cliente.nome}</span>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-texto">
          {cliente.nome}
        </h1>
        <p className="mt-1 text-sm text-suave">
          {cliente.tipo_pessoa === "juridica" ? "Pessoa jurídica" : "Pessoa física"}
          {cliente.cliente_antigo && " · cliente antigo da loja"}
          {totalPedidos ? ` · ${numero(totalPedidos)} pedidos` : " · nenhum pedido"}
          {cliente.cadastrado_em && ` · na casa desde ${dataCurta(cliente.cadastrado_em)}`}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <FormularioCliente c={cliente} aoSalvar={salvarCliente} />
        </div>

        <aside className="space-y-5">
          <GerenciarAcesso
            clienteId={cliente.id}
            temLogin={!!cliente.user_id}
            email={cliente.email}
            podeVerPrecos={cliente.pode_ver_precos}
          />

          <section className="overflow-hidden rounded-xl border border-borda bg-superficie">
            <div className="border-b border-borda px-4 py-3">
              <h2 className="text-sm font-semibold text-texto">
                Últimos pedidos
              </h2>
              {!!totalPedidos && (
                <p className="mt-0.5 text-xs text-suave">
                  {numero(totalPedidos)} no total
                  {gastoTotal > 0 &&
                    ` · ${reais(gastoTotal)} nos ${Math.min(10, totalPedidos)} mais recentes`}
                </p>
              )}
            </div>
            {pedidos?.length ? (
              <ul className="divide-y divide-borda">
                {pedidos.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/admin/pedidos/${p.id}`}
                      className="flex items-center justify-between gap-2 px-4 py-2.5 transition hover:bg-superficie-2"
                    >
                      <div className="min-w-0">
                        <div className="tabular-nums text-sm text-texto">
                          {p.numero}
                        </div>
                        <div className="text-xs text-suave">
                          {dataCurta(p.criado_em)} · {p.total_pecas} peças
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="tabular-nums text-sm font-medium text-texto">
                          {reais(p.total_atacado)}
                        </div>
                        <div className="text-xs text-suave">
                          {STATUS[p.status].nome}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-suave">
                Nenhum pedido ainda.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
