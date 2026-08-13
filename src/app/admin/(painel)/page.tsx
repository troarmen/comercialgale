import type { Metadata } from "next";
import Link from "next/link";
import { numero, reais } from "@/lib/formato";
import { STATUS, dataCurta, type StatusPedido } from "@/lib/pedidos";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Painel · Galé Comercial" };

/** `head: true` pede só o cabeçalho da contagem, sem trazer as linhas. */
const CONTAGEM = { count: "exact", head: true } as const;

/**
 * Situações em que a bola está com o Arthur: o pedido chegou e ainda não
 * virou dinheiro nem foi cancelado.
 */
const PRECISA_ACAO: StatusPedido[] = [
  "novo",
  "em_contato",
  "aguardando_pagamento",
];

/**
 * Só olhamos pendências recentes.
 *
 * O sistema antigo nunca deu baixa em pagamento até 2021: são 288 pedidos de
 * 2017–2020 parados em "aguardando pagamento". Contá-los aqui encheria o
 * painel de tarefas de oito anos atrás. Eles continuam visíveis na tela de
 * Pedidos, que é onde faz sentido garimpar histórico.
 */
const DIAS_PENDENCIA = 90;

const MES_CURTO = new Intl.DateTimeFormat("pt-BR", { month: "short" });

/** Altura máxima da barra do gráfico, em pixels. A coluna toda tem 144 (h-36). */
const ALTURA_BARRA = 108;

function Cartao({
  titulo,
  valor,
  detalhe,
  href,
}: {
  titulo: string;
  valor: string;
  detalhe: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-borda bg-superficie p-5 transition hover:border-borda-forte hover:shadow-sm"
    >
      <div className="text-sm font-medium text-suave">{titulo}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-texto">
        {valor}
      </div>
      <div className="mt-1.5 text-xs text-suave">{detalhe}</div>
    </Link>
  );
}

export default async function Painel() {
  const supabase = await criarClienteServidor();

  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const inicioAno = new Date(agora.getFullYear(), 0, 1);
  // Doze casas no gráfico: a atual mais as onze anteriores.
  const inicioJanela = new Date(agora.getFullYear(), agora.getMonth() - 11, 1);
  const limitePendencia = new Date(agora);
  limitePendencia.setDate(limitePendencia.getDate() - DIAS_PENDENCIA);

  const [{ data: recentes }, produtos, produtosAtivos, clientes, clientesAtivos, novosNoMes, totalPedidos] =
    await Promise.all([
      // Um ano de pedidos dá para tudo desta tela: pendências, mês, ano,
      // últimos pedidos e gráfico. São umas três dezenas de linhas.
      supabase
        .from("pedidos")
        .select(
          "id, numero, status, total_atacado, total_pecas, criado_em, clientes(nome, cidade, uf)",
        )
        .gte("criado_em", inicioJanela.toISOString())
        .order("criado_em", { ascending: false }),
      supabase.from("produtos").select("id", CONTAGEM),
      supabase.from("produtos").select("id", CONTAGEM).eq("ativo", true),
      supabase.from("clientes").select("id", CONTAGEM),
      supabase.from("clientes").select("id", CONTAGEM).eq("status", "ativo"),
      supabase
        .from("clientes")
        .select("id", CONTAGEM)
        .gte("cadastrado_em", inicioMes.toISOString().slice(0, 10)),
      supabase.from("pedidos").select("id", CONTAGEM),
    ]);

  const lista = recentes ?? [];
  const conta = (r: { count: number | null }) => r.count ?? 0;

  const pendentes = lista.filter(
    (p) =>
      PRECISA_ACAO.includes(p.status) &&
      p.criado_em >= limitePendencia.toISOString(),
  );

  const doMes = lista.filter((p) => p.criado_em >= inicioMes.toISOString());
  const doAno = lista.filter((p) => p.criado_em >= inicioAno.toISOString());
  const soma = (ps: typeof lista) =>
    ps.reduce((t, p) => t + Number(p.total_atacado ?? 0), 0);

  // Doze baldes fixos, para o gráfico não sumir com mês sem pedido.
  const meses = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(agora.getFullYear(), agora.getMonth() - 11 + i, 1);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const doBalde = lista.filter((p) => p.criado_em.slice(0, 7) === chave);
    return {
      chave,
      rotulo: MES_CURTO.format(d).replace(".", ""),
      ano: d.getFullYear(),
      pedidos: doBalde.length,
      valor: soma(doBalde),
    };
  });
  const maiorMes = Math.max(1, ...meses.map((m) => m.pedidos));

  const ultimos = lista.slice(0, 6);

  return (
    <div className="px-8 py-7">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-texto">
          Painel
        </h1>
        <p className="mt-1 text-sm text-suave">
          O que está em aberto e como o mês está indo.
        </p>
      </header>

      {/* ---------------------------------------------------- o que fazer */}
      {pendentes.length > 0 ? (
        <section className="mb-6 rounded-xl border border-alerta-texto/30 bg-alerta-fundo p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-alerta-texto">
                {pendentes.length === 1
                  ? "1 pedido esperando você"
                  : `${pendentes.length} pedidos esperando você`}
              </h2>
              {/* `text-suave` e não o laranja a 80%: sobre o fundo âmbar do
                  aviso, o laranja esmaecido cai para 3,27:1 no tema claro. */}
              <p className="mt-0.5 text-sm text-suave">
                Somam {reais(soma(pendentes))} e ainda não foram pagos.
              </p>
            </div>
            <Link
              href="/admin/pedidos?status=novo"
              className="rounded-lg bg-acento px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-acento-forte"
            >
              Ver pedidos
            </Link>
          </div>

          <ul className="mt-4 space-y-1.5">
            {pendentes.slice(0, 5).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/pedidos/${p.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-superficie/60 px-3 py-2 text-sm transition hover:bg-superficie"
                >
                  <span className="font-medium tabular-nums text-texto">
                    {p.numero}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-suave">
                    {p.clientes?.nome ?? "—"}
                  </span>
                  <span className="tabular-nums text-suave">
                    {dataCurta(p.criado_em)}
                  </span>
                  <span className="tabular-nums font-medium text-texto">
                    {reais(p.total_atacado)}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[p.status].cor}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS[p.status].ponto}`} />
                    {STATUS[p.status].nome}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="mb-6 rounded-xl border border-borda bg-superficie p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-texto">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ok-fundo">
              <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 text-ok-texto" aria-hidden="true">
                <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            Nenhum pedido esperando resposta
          </h2>
          <p className="mt-1 text-sm text-suave">
            Tudo dos últimos {DIAS_PENDENCIA} dias já foi resolvido. Pedidos
            antigos do sistema anterior continuam na tela de{" "}
            <Link href="/admin/pedidos" className="text-acento-texto underline-offset-2 hover:underline">
              Pedidos
            </Link>
            .
          </p>
        </section>
      )}

      {/* ------------------------------------------------------- números */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao
          titulo="Pedidos no mês"
          valor={numero(doMes.length)}
          detalhe={doMes.length ? reais(soma(doMes)) : "nenhum ainda"}
          href="/admin/pedidos"
        />
        <Cartao
          titulo={`Pedidos em ${agora.getFullYear()}`}
          valor={numero(doAno.length)}
          detalhe={reais(soma(doAno))}
          href="/admin/pedidos"
        />
        <Cartao
          titulo="Clientes novos no mês"
          valor={numero(conta(novosNoMes))}
          detalhe={`${numero(conta(clientesAtivos))} de ${numero(conta(clientes))} com acesso liberado`}
          href="/admin/clientes"
        />
        <Cartao
          titulo="Produtos no catálogo"
          valor={numero(conta(produtosAtivos))}
          detalhe={`${numero(conta(produtos) - conta(produtosAtivos))} desativados`}
          href="/admin/produtos"
        />
      </div>

      {/* ------------------------------------------------- últimos pedidos */}
      <section className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-borda bg-superficie lg:col-span-3">
          <div className="flex items-center justify-between border-b border-borda px-5 py-3.5">
            <h2 className="text-sm font-semibold text-texto">Últimos pedidos</h2>
            <Link
              href="/admin/pedidos"
              className="text-xs text-suave transition hover:text-texto"
            >
              ver todos ({numero(conta(totalPedidos))})
            </Link>
          </div>

          {ultimos.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-suave">
              Nenhum pedido nos últimos doze meses.
            </p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {ultimos.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-borda last:border-0 transition hover:bg-superficie-2"
                  >
                    <td className="py-2.5 pl-5 pr-3">
                      <Link
                        href={`/admin/pedidos/${p.id}`}
                        className="font-medium tabular-nums text-texto hover:text-acento-texto"
                      >
                        {p.numero}
                      </Link>
                      <div className="truncate text-xs text-suave">
                        {p.clientes?.nome ?? "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-suave">
                      {dataCurta(p.criado_em)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-texto">
                      {reais(p.total_atacado)}
                    </td>
                    <td className="py-2.5 pl-3 pr-5 text-right">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[p.status].cor}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS[p.status].ponto}`} />
                        {STATUS[p.status].nome}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ----------------------------------------------------- gráfico */}
        <div className="rounded-xl border border-borda bg-superficie p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-texto">
            Pedidos por mês
          </h2>
          <p className="mt-0.5 text-xs text-suave">Últimos doze meses</p>

          {/* Altura da barra em pixels, não em porcentagem: dentro de um flex
              column a altura percentual não tem de quem herdar e a barra
              simplesmente não aparece. ALTURA_BARRA é o espaço útil da coluna
              depois do número e do rótulo. */}
          <div className="mt-5 flex h-36 items-end gap-1.5">
            {meses.map((m) => (
              <div
                key={m.chave}
                className="group flex flex-1 flex-col items-center justify-end gap-1.5"
                title={`${m.rotulo}/${m.ano}: ${m.pedidos} ${m.pedidos === 1 ? "pedido" : "pedidos"} · ${reais(m.valor)}`}
              >
                <span className="text-[10px] tabular-nums text-tenue opacity-0 transition group-hover:opacity-100">
                  {m.pedidos || ""}
                </span>
                <div
                  className="w-full rounded-t bg-acento/70 transition group-hover:bg-acento"
                  style={{
                    height: m.pedidos
                      ? `${Math.max(4, Math.round((m.pedidos / maiorMes) * ALTURA_BARRA))}px`
                      : "2px",
                  }}
                />
                <span className="text-[10px] text-tenue">{m.rotulo}</span>
              </div>
            ))}
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-borda pt-4">
            <div>
              <dt className="text-xs text-suave">Ticket médio no ano</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-texto">
                {doAno.length ? reais(soma(doAno) / doAno.length) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-suave">Peças no ano</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-texto">
                {numero(doAno.reduce((t, p) => t + (p.total_pecas ?? 0), 0))}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}
