import type { Metadata } from "next";
import Link from "next/link";
import { Paginacao } from "@/components/paginacao";
import { numero, reais } from "@/lib/formato";
import { ORDEM_STATUS, STATUS, dataCurta, type StatusPedido } from "@/lib/pedidos";
import { criarClienteServidor } from "@/lib/supabase/server";
import { BuscaPedidos } from "./busca";

export const metadata: Metadata = { title: "Pedidos · Galé Comercial" };

const POR_PAGINA = 30;

export default async function PaginaPedidos({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; status?: string; pagina?: string }>;
}) {
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const de = (pagina - 1) * POR_PAGINA;

  const supabase = await criarClienteServidor();

  let consulta = supabase
    .from("pedidos")
    .select(
      "id, numero, status, total_atacado, total_pecas, criado_em, vinculo_revisar, clientes(nome, cidade, uf)",
      { count: "exact" },
    );

  if (sp.busca?.trim()) {
    const termo = sp.busca.trim();
    // Busca pelo número do pedido. O nome do cliente está em outra tabela e o
    // PostgREST não filtra por coluna de tabela embutida sem `!inner`, então
    // resolvemos abaixo com uma consulta separada quando não parece número.
    consulta = consulta.ilike("numero", `%${termo}%`);
  }
  if (sp.status && sp.status in STATUS) {
    consulta = consulta.eq("status", sp.status as StatusPedido);
  }

  const { data, count } = await consulta
    .order("criado_em", { ascending: false })
    .range(de, de + POR_PAGINA - 1);

  const lista = data ?? [];
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  // Contagem por status, para as abas
  const { data: todos } = await supabase.from("pedidos").select("status");
  const porStatus = new Map<string, number>();
  for (const p of todos ?? []) {
    porStatus.set(p.status, (porStatus.get(p.status) ?? 0) + 1);
  }

  return (
    <div className="px-8 py-7">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-texto">
          Pedidos
        </h1>
        <p className="mt-1 text-sm text-suave">
          {numero(total)} {total === 1 ? "pedido" : "pedidos"}
          {sp.status && ` com situação "${STATUS[sp.status as StatusPedido]?.nome}"`}
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <BuscaPedidos />
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        <Link
          href="/admin/pedidos"
          className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm transition ${
            !sp.status
              ? "bg-superficie font-medium text-texto shadow-sm"
              : "text-suave hover:bg-superficie hover:text-texto"
          }`}
        >
          Todos
          <span className="tabular-nums text-xs text-tenue">
            {todos?.length ?? 0}
          </span>
        </Link>
        {ORDEM_STATUS.filter((s) => porStatus.get(s)).map((s) => (
          <Link
            key={s}
            href={`?status=${s}`}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm transition ${
              sp.status === s
                ? "bg-superficie font-medium text-texto shadow-sm"
                : "text-suave hover:bg-superficie hover:text-texto"
            }`}
          >
            {STATUS[s].nome}
            <span className="tabular-nums text-xs text-tenue">
              {porStatus.get(s)}
            </span>
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-borda bg-superficie">
        {lista.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-texto">Nenhum pedido</p>
            <p className="mt-1 text-sm text-suave">
              Ajuste os filtros ou aguarde o próximo pedido entrar.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-tenue">
                  <th className="px-4 py-3 font-medium">Pedido</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 text-center font-medium">Peças</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-center font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => {
                  const s = STATUS[p.status];
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-borda last:border-0 transition hover:bg-superficie-2"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/admin/pedidos/${p.id}`}
                          className="font-medium tabular-nums text-texto hover:text-acento-texto"
                        >
                          {p.numero}
                        </Link>
                        {p.vinculo_revisar && (
                          <span
                            title="O cliente deste pedido foi deduzido na migração — confirme"
                            className="ml-2 rounded bg-alerta-fundo px-1.5 py-0.5 text-[10px] font-semibold uppercase text-alerta-texto"
                          >
                            revisar
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="truncate text-texto">
                          {p.clientes?.nome ?? "—"}
                        </div>
                        {p.clientes?.cidade && (
                          <div className="text-xs text-suave">
                            {p.clientes.cidade}
                            {p.clientes.uf ? `/${p.clientes.uf}` : ""}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-suave">
                        {dataCurta(p.criado_em)}
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-suave">
                        {p.total_pecas}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-texto">
                        {reais(p.total_atacado)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${s.cor}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${s.ponto}`} />
                          {s.nome}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {paginas > 1 && (
        <Paginacao pagina={pagina} paginas={paginas} total={total} />
      )}
    </div>
  );
}
