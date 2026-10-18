"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  alterarQtdDoCarrinho,
  chaveItem,
  limparCarrinho,
  removerDoCarrinho,
  useCarrinho,
} from "@/components/catalogo/carrinho";
import { reais } from "@/lib/formato";
import {
  consultarCarrinho,
  fecharPedido,
  type ResultadoPedido,
} from "./acoes";

type Situacao = Awaited<ReturnType<typeof consultarCarrinho>>;

/**
 * O pedido é mostrado como TABELA, sem foto — pedido de atacado se confere
 * linha a linha, como a planilha do balcão (feedback do cliente, out/2026).
 * Atacado e Varejo aparecem lado a lado, e o valor de referência de R$ 500
 * virou AVISO: não bloqueia mais o fechamento.
 */
export function PaginaCarrinhoCliente() {
  const { itens, pronto } = useCarrinho();
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [resultado, setResultado] = useState<ResultadoPedido | null>(null);
  const [fechando, iniciarFechamento] = useTransition();

  // Os preços dependem do CONJUNTO de itens, não das quantidades — só
  // reconsulta quando entra ou sai produto do carrinho.
  const assinatura = useMemo(
    () => itens.map(chaveItem).sort().join("|"),
    [itens],
  );

  useEffect(() => {
    if (!pronto) return;
    let cancelado = false;
    consultarCarrinho(
      itens.map((i) => ({
        produtoId: i.produtoId,
        produtoTamanhoId: i.produtoTamanhoId,
      })),
    ).then((s) => {
      if (!cancelado) setSituacao(s);
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, assinatura]);

  // ------------------------------------------------------------- fechado!
  if (resultado?.ok) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-borda/60 bg-superficie p-8 text-center shadow-suave">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ok-fundo">
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-ok-texto" aria-hidden="true">
            <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-texto">
          Pedido {resultado.numero} recebido!
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-suave">
          Enviamos a confirmação para o seu e-mail. Nossa equipe entra em
          contato para combinar o pagamento e o envio — nada é cobrado pelo
          site.
        </p>
        <Link
          href="/produtos"
          className="mt-6 inline-flex h-11 items-center rounded-full bg-acento px-6 text-sm font-semibold text-white transition hover:bg-acento-forte"
        >
          Continuar comprando
        </Link>
      </div>
    );
  }

  // ------------------------------------------------------------- esqueleto
  if (!pronto) {
    return (
      <div aria-hidden="true" className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl border border-borda bg-superficie" />
        ))}
      </div>
    );
  }

  // ------------------------------------------------------------- vazio
  if (!itens.length) {
    return (
      <div className="rounded-2xl border border-borda/60 bg-superficie px-6 py-20 text-center shadow-pousada">
        <p className="text-base font-semibold text-texto">
          Seu pedido está vazio
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-suave">
          Navegue pelo catálogo, monte a grade de cada produto e volte aqui para
          fechar tudo de uma vez.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/produtos"
            className="flex h-11 items-center rounded-full bg-acento px-6 text-sm font-semibold text-white transition hover:bg-acento-forte"
          >
            Ver o catálogo
          </Link>
          <Link
            href="/lancamentos"
            className="text-sm font-semibold text-acento-texto transition hover:text-acento-forte"
          >
            Ver lançamentos
          </Link>
        </div>
      </div>
    );
  }

  const precoDe = (chave: string) => situacao?.precos?.[chave];
  const indisponiveis = new Set(situacao?.indisponiveis ?? []);
  const podeVerPrecos = !!situacao?.clienteAtivo;
  const exibirVarejoConfig = podeVerPrecos && situacao?.exibirVarejo !== false;

  const totalAtacado = itens.reduce((s, i) => {
    const p = precoDe(chaveItem(i));
    return s + (p ? p.precoKitAtacado * i.qtdKits : 0);
  }, 0);
  const totalVarejo = itens.reduce((s, i) => {
    const p = precoDe(chaveItem(i));
    return s + (p ? p.precoKitVarejo * i.qtdKits : 0);
  }, 0);
  // nenhum item com varejo cadastrado? a dupla de colunas não aparece
  const exibirVarejo =
    exibirVarejoConfig &&
    itens.some((i) => (precoDe(chaveItem(i))?.precoKitVarejo ?? 0) > 0);
  const totalPecas = itens.reduce((s, i) => s + i.pecasNoKit * i.qtdKits, 0);
  const totalEmbalagens = itens.reduce((s, i) => s + i.qtdKits, 0);
  const pedidoMinimo = situacao?.pedidoMinimo ?? 0;
  const abaixoDoMinimo =
    podeVerPrecos && pedidoMinimo > 0 && totalAtacado > 0 && totalAtacado < pedidoMinimo;
  const temIndisponivel = itens.some((i) => indisponiveis.has(chaveItem(i)));

  function confirmar() {
    setResultado(null);
    iniciarFechamento(async () => {
      const r = await fecharPedido(
        itens.map((i) => ({
          produtoId: i.produtoId,
          produtoTamanhoId: i.produtoTamanhoId,
          qtdKits: i.qtdKits,
        })),
        observacoes,
      );
      setResultado(r);
      if (r.ok) limparCarrinho();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* ------------------------------------------------- tabela do pedido */}
      <div className="h-fit overflow-hidden rounded-2xl border border-borda/60 bg-superficie shadow-pousada">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-borda bg-superficie-2 text-left text-xs uppercase tracking-wide text-tenue">
                <th scope="col" className="px-4 py-3 font-medium">Produto</th>
                <th scope="col" className="px-2 py-3 font-medium">Tam.</th>
                <th scope="col" className="px-2 py-3 text-center font-medium">Emb. c/</th>
                <th scope="col" className="px-2 py-3 text-center font-medium">Qtd</th>
                {podeVerPrecos && (
                  <>
                    <th scope="col" className="whitespace-nowrap px-2 py-3 text-right font-medium">Atacado</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3 text-right font-medium">Total Atacado</th>
                  </>
                )}
                {exibirVarejo && (
                  <>
                    <th scope="col" className="whitespace-nowrap px-2 py-3 text-right font-medium">Varejo</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3 text-right font-medium">Total Varejo</th>
                  </>
                )}
                <th scope="col" className="px-2 py-3">
                  <span className="sr-only">Remover</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => {
                const chave = chaveItem(item);
                const preco = precoDe(chave);
                const indisponivel = indisponiveis.has(chave);
                return (
                  <tr
                    key={chave}
                    className={`border-b border-borda last:border-0 ${
                      indisponivel ? "bg-alerta-fundo" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/produto/${item.slug}`}
                        className="font-medium text-texto transition hover:text-acento-texto"
                      >
                        {item.titulo}
                      </Link>
                      <p className="text-xs text-suave">
                        Ref. {item.modelo}
                        {item.marca ? ` · ${item.marca}` : ""}
                      </p>
                      {indisponivel && (
                        <p className="mt-0.5 text-xs font-semibold text-alerta-texto">
                          Saiu do catálogo — remova para fechar o pedido.
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-suave">
                      {item.tamanho ?? "Único"}
                    </td>
                    <td className="px-2 py-2.5 text-center tabular-nums text-suave">
                      {item.pecasNoKit}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="mx-auto flex w-fit items-center rounded-lg border border-borda bg-superficie">
                        <button
                          type="button"
                          onClick={() => alterarQtdDoCarrinho(chave, item.qtdKits - 1)}
                          aria-label={`Tirar uma embalagem de ${item.titulo}`}
                          className="flex h-8 w-8 items-center justify-center text-suave transition hover:text-texto"
                        >
                          −
                        </button>
                        <span aria-live="polite" className="w-7 text-center text-sm font-semibold tabular-nums text-texto">
                          {item.qtdKits}
                        </span>
                        <button
                          type="button"
                          onClick={() => alterarQtdDoCarrinho(chave, item.qtdKits + 1)}
                          aria-label={`Somar uma embalagem de ${item.titulo}`}
                          className="flex h-8 w-8 items-center justify-center text-suave transition hover:text-texto"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    {podeVerPrecos && (
                      <>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-suave">
                          {preco ? reais(preco.precoKitAtacado) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right font-medium tabular-nums text-texto">
                          {preco ? reais(preco.precoKitAtacado * item.qtdKits) : "—"}
                        </td>
                      </>
                    )}
                    {exibirVarejo && (
                      <>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-suave">
                          {preco && preco.precoKitVarejo > 0 ? reais(preco.precoKitVarejo) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-suave">
                          {preco && preco.precoKitVarejo > 0
                            ? reais(preco.precoKitVarejo * item.qtdKits)
                            : "—"}
                        </td>
                      </>
                    )}
                    <td className="px-2 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => removerDoCarrinho(chave)}
                        aria-label={`Remover ${item.titulo} do pedido`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-tenue transition hover:bg-superficie-2 hover:text-acento-texto"
                      >
                        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                          <path d="M5 7h14M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7V4h6v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {podeVerPrecos && (
              <tfoot>
                <tr className="border-t-2 border-borda bg-superficie-2 font-semibold text-texto">
                  <td className="px-4 py-3" colSpan={3}>
                    Totais
                  </td>
                  <td className="px-2 py-3 text-center tabular-nums">{totalEmbalagens}</td>
                  <td className="px-2 py-3" />
                  <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">
                    {reais(totalAtacado)}
                  </td>
                  {exibirVarejo && (
                    <>
                      <td className="px-2 py-3" />
                      <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums text-suave">
                        {reais(totalVarejo)}
                      </td>
                    </>
                  )}
                  <td className="px-2 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="border-t border-borda px-4 py-2.5 text-xs text-tenue">
          Qtd = embalagens fechadas. Seu carrinho fica salvo neste navegador por
          até 90 dias.
        </p>
      </div>

      {/* ----------------------------------------------------------- resumo */}
      <aside className="h-fit rounded-2xl border border-borda/60 bg-superficie p-5 shadow-suave lg:sticky lg:top-40">
        <h2 className="text-sm font-semibold text-texto">Resumo do pedido</h2>

        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-suave">Embalagens</dt>
            <dd className="font-medium tabular-nums text-texto">{totalEmbalagens}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-suave">Peças</dt>
            <dd className="font-medium tabular-nums text-texto">{totalPecas}</dd>
          </div>
          {podeVerPrecos && (
            <div className="flex justify-between border-t border-borda pt-2 text-base">
              <dt className="font-semibold text-texto">Total Atacado</dt>
              <dd className="font-bold tabular-nums text-texto">
                {reais(totalAtacado)}
              </dd>
            </div>
          )}
          {exibirVarejo && (
            <div className="flex justify-between">
              <dt className="text-suave">Total Varejo</dt>
              <dd className="font-medium tabular-nums text-suave">
                {reais(totalVarejo)}
              </dd>
            </div>
          )}
        </dl>

        {podeVerPrecos ? (
          <>
            {abaixoDoMinimo && (
              <p className="mt-3 rounded-lg bg-alerta-fundo px-3 py-2 text-xs font-medium leading-relaxed text-alerta-texto">
                Compras no atacado são a partir de {reais(pedidoMinimo)} — o seu
                pedido está em {reais(totalAtacado)}. Dá para fechar mesmo
                assim: nossa equipe confirma as condições com você.
              </p>
            )}

            <label htmlFor="observacoes" className="mt-4 block text-xs font-medium text-suave">
              Observações para a equipe (opcional)
            </label>
            <textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Ex.: prefiro receber por transportadora X…"
              className="mt-1.5 w-full rounded-lg border border-borda bg-superficie px-3 py-2 text-sm text-texto outline-none transition placeholder:text-tenue focus:border-gale-500"
            />

            {resultado && !resultado.ok && (
              <p role="alert" className="mt-3 rounded-lg bg-alerta-fundo px-3 py-2 text-sm font-medium text-alerta-texto">
                {resultado.erro}
              </p>
            )}

            <button
              type="button"
              onClick={confirmar}
              disabled={fechando || temIndisponivel || totalEmbalagens === 0}
              className="mt-4 h-12 w-full rounded-full bg-acento text-sm font-semibold text-white transition hover:bg-acento-forte disabled:cursor-not-allowed disabled:opacity-40"
            >
              {fechando ? "Fechando pedido…" : "Fechar pedido"}
            </button>
            <p className="mt-2.5 text-xs leading-relaxed text-suave">
              Sem cobrança pelo site: você recebe a confirmação por e-mail e a
              equipe combina pagamento e envio com você.
            </p>
          </>
        ) : situacao ? (
          <div className="mt-4 rounded-xl bg-superficie-2 p-4">
            <p className="text-sm font-semibold text-texto">
              {situacao.logado
                ? "Conta aguardando liberação"
                : "Entre para ver os valores"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-suave">
              {situacao.logado
                ? "Assim que a equipe aprovar o seu cadastro, os preços de Atacado e Varejo aparecem e o pedido pode ser fechado."
                : "O carrinho fica guardado. Entre na conta ou cadastre a sua loja para fechar o pedido com preço de Atacado e Varejo."}
            </p>
            {!situacao.logado && (
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  href="/entrar?destino=/carrinho"
                  className="flex h-10 items-center justify-center rounded-full bg-acento px-5 text-sm font-semibold text-white transition hover:bg-acento-forte"
                >
                  Entrar
                </Link>
                <Link
                  href="/cadastro"
                  className="flex h-10 items-center justify-center rounded-full border border-borda px-5 text-sm font-semibold text-texto transition hover:border-borda-forte"
                >
                  Cadastrar minha loja
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 h-24 animate-pulse rounded-xl bg-borda/50" aria-hidden="true" />
        )}
      </aside>
    </div>
  );
}
