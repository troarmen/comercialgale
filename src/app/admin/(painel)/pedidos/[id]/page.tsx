import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { numero, reais } from "@/lib/formato";
import { STATUS, clienteDoPedido, dataHora } from "@/lib/pedidos";
import { perfilEquipe } from "@/lib/sessao";
import { AvisoVinculo, Observacao, TrocarStatus } from "./controles";

export const metadata: Metadata = { title: "Pedido · Galé Comercial" };

export default async function PaginaPedido({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // O layout do painel já barrou quem não é da equipe. Colaborador vê a
  // ficha inteira, mas sem nenhum controle e sem links para seções de admin.
  const perfil = await perfilEquipe();
  if (!perfil) notFound();
  const { supabase } = perfil;
  const ehAdmin = perfil.papel === "admin";

  const { data: pedido } = await supabase
    .from("pedidos")
    .select(
      `id, numero, status, total_atacado, total_varejo, total_pecas, desconto,
       criado_em, observacoes_cliente, observacoes_admin, vinculo_revisar,
       snapshot_cliente,
       clientes(id, nome, nome_fantasia, documento, email, telefone1, telefone2,
                cidade, uf, bairro, logradouro, numero, cep, tipo_pessoa)`,
    )
    .eq("id", Number(id))
    .maybeSingle();

  if (!pedido) notFound();

  const { data: itens } = await supabase
    .from("pedido_itens")
    .select(
      `id, produto_id, produto_titulo, produto_modelo, tamanho,
       pecas_no_kit, qtd_kits, preco_kit_atacado, preco_kit_varejo,
       preco_unitario_atacado, total_atacado, total_varejo, total_pecas`,
    )
    .eq("pedido_id", pedido.id)
    .order("produto_titulo")
    .order("tamanho");

  // Colaborador não lê `clientes`: o join vem null e o snapshot assume.
  const c = clienteDoPedido(pedido.clientes, pedido.snapshot_cliente);
  const s = STATUS[pedido.status];
  const linhas = itens ?? [];

  return (
    <div className="px-8 py-7">
      <nav className="mb-3 text-sm text-suave">
        <Link href="/admin/pedidos" className="transition hover:text-texto">
          Pedidos
        </Link>
        <span className="px-1.5 text-tenue">/</span>
        <span className="tabular-nums text-texto">{pedido.numero}</span>
      </nav>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tabular-nums tracking-tight text-texto">
              {pedido.numero}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.cor}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${s.ponto}`} />
              {s.nome}
            </span>
          </div>
          <p className="mt-1 text-sm text-suave">
            Recebido em {dataHora(pedido.criado_em)}
          </p>
        </div>
        {ehAdmin && (
          <div className="w-56">
            <TrocarStatus id={pedido.id} atual={pedido.status} />
          </div>
        )}
      </header>

      {ehAdmin && pedido.vinculo_revisar && <AvisoVinculo id={pedido.id} />}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-xl border border-borda bg-superficie">
            <div className="border-b border-borda px-4 py-3">
              <h2 className="text-sm font-semibold text-texto">
                Itens do pedido
              </h2>
              <p className="mt-0.5 text-xs text-suave">
                {linhas.length} {linhas.length === 1 ? "linha" : "linhas"} ·{" "}
                {numero(pedido.total_pecas)} peças no total
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-tenue">
                    <th className="px-4 py-2.5 font-medium">Produto</th>
                    <th className="px-4 py-2.5 font-medium">Tam.</th>
                    <th className="px-4 py-2.5 text-center font-medium">Kit</th>
                    <th className="px-4 py-2.5 text-right font-medium">Unit.</th>
                    <th className="px-4 py-2.5 text-center font-medium">Qtd</th>
                    <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((i) => (
                    <tr
                      key={i.id}
                      className="border-b border-borda last:border-0"
                    >
                      <td className="px-4 py-2">
                        {ehAdmin && i.produto_id ? (
                          <Link
                            href={`/admin/produtos/${i.produto_id}`}
                            className="text-texto hover:text-acento-texto"
                          >
                            {i.produto_titulo}
                          </Link>
                        ) : (
                          <span className="text-texto">{i.produto_titulo}</span>
                        )}
                        <div className="text-xs text-suave">
                          ref. {i.produto_modelo}
                          {!i.produto_id && " · fora do catálogo"}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-suave">{i.tamanho ?? "—"}</td>
                      <td className="px-4 py-2 text-center tabular-nums text-suave">
                        {i.pecas_no_kit}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-suave">
                        {reais(i.preco_unitario_atacado)}
                      </td>
                      <td className="px-4 py-2 text-center tabular-nums text-suave">
                        {i.qtd_kits}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium text-texto">
                        {reais(i.total_atacado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-borda bg-superficie-2">
                    <td colSpan={5} className="px-4 py-2.5 text-right text-suave">
                      Total do pedido
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-base font-semibold text-texto">
                      {reais(pedido.total_atacado)}
                    </td>
                  </tr>
                  <tr className="border-t border-borda">
                    <td colSpan={5} className="px-4 py-2 text-right text-xs text-tenue">
                      Se revendido pelo preço sugerido
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-xs text-tenue">
                      {reais(pedido.total_varejo)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {pedido.observacoes_cliente && (
            <section className="rounded-xl border border-borda bg-superficie p-4">
              <h2 className="text-sm font-semibold text-texto">
                Observação do cliente
              </h2>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-suave">
                {pedido.observacoes_cliente}
              </p>
            </section>
          )}

          {ehAdmin ? (
            <section className="rounded-xl border border-borda bg-superficie p-4">
              <Observacao
                id={pedido.id}
                inicial={pedido.observacoes_admin ?? ""}
              />
            </section>
          ) : (
            pedido.observacoes_admin && (
              <section className="rounded-xl border border-borda bg-superficie p-4">
                <h2 className="text-sm font-semibold text-texto">
                  Anotações internas
                </h2>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-suave">
                  {pedido.observacoes_admin}
                </p>
              </section>
            )
          )}
        </div>

        <aside className="space-y-5">
          <section className="rounded-xl border border-borda bg-superficie p-4">
            <h2 className="mb-3 text-sm font-semibold text-texto">Cliente</h2>
            {c ? (
              <dl className="space-y-2.5 text-sm">
                <div>
                  <dt className="text-xs text-tenue">Nome</dt>
                  <dd className="text-texto">
                    {ehAdmin && c.id ? (
                      <Link
                        href={`/admin/clientes/${c.id}`}
                        className="hover:text-acento-texto"
                      >
                        {c.nome}
                      </Link>
                    ) : (
                      c.nome
                    )}
                  </dd>
                  {c.nome_fantasia && (
                    <dd className="text-xs text-suave">{c.nome_fantasia}</dd>
                  )}
                </div>
                {c.documento && (
                  <div>
                    <dt className="text-xs text-tenue">
                      {c.tipo_pessoa === "juridica" ? "CNPJ" : "CPF"}
                    </dt>
                    <dd className="tabular-nums text-texto">{c.documento}</dd>
                  </div>
                )}
                {c.email && (
                  <div>
                    <dt className="text-xs text-tenue">E-mail</dt>
                    <dd className="break-all text-texto">
                      <a href={`mailto:${c.email}`} className="hover:text-acento-texto">
                        {c.email}
                      </a>
                    </dd>
                  </div>
                )}
                {(c.telefone1 || c.telefone2) && (
                  <div>
                    <dt className="text-xs text-tenue">Telefone</dt>
                    <dd className="text-texto">
                      {[c.telefone1, c.telefone2].filter(Boolean).join(" · ")}
                    </dd>
                  </div>
                )}
                {(c.logradouro || c.cidade) && (
                  <div>
                    <dt className="text-xs text-tenue">Endereço</dt>
                    <dd className="leading-relaxed text-texto">
                      {[c.logradouro, c.numero].filter(Boolean).join(", ")}
                      {c.bairro && <br />}
                      {c.bairro}
                      {(c.cidade || c.cep) && <br />}
                      {[c.cidade, c.uf].filter(Boolean).join("/")}
                      {c.cep ? ` · ${c.cep}` : ""}
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm text-suave">Cadastro não encontrado.</p>
            )}
          </section>

          {ehAdmin && (
            <section className="rounded-xl border border-borda bg-superficie p-4">
              <h2 className="mb-2 text-sm font-semibold text-texto">
                Como cobrar
              </h2>
              <p className="text-sm leading-relaxed text-suave">
                O pagamento não passa pelo site. Combine com o cliente pelo
                contato acima e atualize a situação do pedido aqui.
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
