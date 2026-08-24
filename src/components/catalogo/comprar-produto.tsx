"use client";

import Link from "next/link";
import { useState } from "react";
import { reais } from "@/lib/formato";
import { adicionarAoCarrinho } from "./carrinho";

/**
 * Caixa de compra da ficha do produto.
 *
 * Atacado se compra em grade: em vez de "escolha um tamanho", cada tamanho tem
 * o seu contador de kits e um botão só manda tudo para o pedido. O lojista
 * monta a grade como faria no balcão.
 *
 * Sem login liberado não existe linha de preço (a view devolve vazio) — a
 * caixa vira o convite de cadastro, com os tamanhos visíveis a título de
 * informação.
 */

export type LinhaGrade = {
  produtoTamanhoId: number | null;
  tamanho: string | null;
  precoKitAtacado: number;
  precoKitVarejo: number;
  precoUnitarioAtacado: number;
};

export function ComprarProduto({
  produto,
  grade,
  tamanhosSemPreco,
  pecasNoKit,
  exibirVarejo,
}: {
  produto: {
    id: number;
    slug: string;
    titulo: string;
    modelo: string;
    foto: string | null;
  };
  /** linhas da view de preços — vazio quando o visitante não pode ver */
  grade: LinhaGrade[];
  /** tamanhos públicos, para o visitante saber o que existe */
  tamanhosSemPreco: string[];
  pecasNoKit: number;
  exibirVarejo: boolean;
}) {
  const [qtds, setQtds] = useState<Record<string, number>>({});
  const [confirmacao, setConfirmacao] = useState(false);

  // ---------------------------------------------------------- sem preço
  if (!grade.length) {
    return (
      <div className="rounded-2xl border border-borda/60 bg-superficie p-6 shadow-suave">
        {tamanhosSemPreco.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-texto">
              Tamanhos disponíveis
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {tamanhosSemPreco.map((t) => (
                <li
                  key={t}
                  className="rounded-lg border border-borda bg-superficie-2 px-3 py-1.5 text-sm text-suave"
                >
                  {t}
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-5 rounded-xl bg-superficie-2 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-texto">
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-acento-texto" aria-hidden="true">
              <rect x="3.5" y="7" width="9" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            Preço de atacado é para clientes cadastrados
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-suave">
            Cadastre a sua loja gratuitamente. Assim que o acesso for liberado,
            você vê os preços de todo o catálogo e monta o pedido online.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/cadastro"
              className="flex h-11 items-center rounded-full bg-acento px-5 text-sm font-semibold text-white transition hover:bg-acento-forte"
            >
              Quero comprar no atacado
            </Link>
            <Link
              href="/entrar"
              className="text-sm font-semibold text-acento-texto transition hover:text-acento-forte"
            >
              Já sou cliente
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------- com preço
  const totalKits = Object.values(qtds).reduce((s, n) => s + n, 0);
  const totalValor = grade.reduce(
    (s, l) => s + (qtds[String(l.produtoTamanhoId)] ?? 0) * l.precoKitAtacado,
    0,
  );

  function mudar(chave: string, delta: number) {
    setQtds((atual) => {
      const novo = Math.max(0, Math.min(999, (atual[chave] ?? 0) + delta));
      return { ...atual, [chave]: novo };
    });
  }

  function adicionarTudo() {
    for (const linha of grade) {
      const qtd = qtds[String(linha.produtoTamanhoId)] ?? 0;
      if (qtd <= 0) continue;
      adicionarAoCarrinho(
        {
          produtoId: produto.id,
          produtoTamanhoId: linha.produtoTamanhoId,
          slug: produto.slug,
          titulo: produto.titulo,
          modelo: produto.modelo,
          tamanho: linha.tamanho,
          pecasNoKit,
          foto: produto.foto,
        },
        qtd,
      );
    }
    setQtds({});
    setConfirmacao(true);
    setTimeout(() => setConfirmacao(false), 4000);
  }

  return (
    <div className="rounded-2xl border border-borda/60 bg-superficie p-5 shadow-suave sm:p-6">
      <h2 className="text-sm font-semibold text-texto">
        Monte a sua grade
        <span className="ml-2 font-normal text-suave">
          kit fechado com {pecasNoKit} {pecasNoKit === 1 ? "peça" : "peças"}
        </span>
      </h2>

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-tenue">
            <th className="py-2 pr-2 font-medium">Tamanho</th>
            <th className="py-2 pr-2 text-right font-medium">Kit</th>
            {pecasNoKit > 1 && (
              <th className="hidden py-2 pr-2 text-right font-medium sm:table-cell">
                Por peça
              </th>
            )}
            <th className="py-2 text-right font-medium">Kits</th>
          </tr>
        </thead>
        <tbody>
          {grade.map((linha) => {
            const chave = String(linha.produtoTamanhoId);
            const qtd = qtds[chave] ?? 0;
            return (
              <tr key={chave} className="border-b border-borda last:border-0">
                <td className="py-2.5 pr-2 font-medium text-texto">
                  {linha.tamanho ?? "Único"}
                </td>
                <td className="py-2.5 pr-2 text-right tabular-nums text-texto">
                  {reais(linha.precoKitAtacado)}
                </td>
                {pecasNoKit > 1 && (
                  <td className="hidden py-2.5 pr-2 text-right tabular-nums text-suave sm:table-cell">
                    {reais(linha.precoUnitarioAtacado)}
                  </td>
                )}
                <td className="py-2">
                  <div className="ml-auto flex w-fit items-center rounded-lg border border-borda">
                    <button
                      type="button"
                      onClick={() => mudar(chave, -1)}
                      disabled={qtd <= 0}
                      aria-label={`Tirar um kit do tamanho ${linha.tamanho ?? "único"}`}
                      className="flex h-9 w-9 items-center justify-center text-suave transition hover:text-texto disabled:opacity-30"
                    >
                      −
                    </button>
                    <span
                      aria-live="polite"
                      className="w-8 text-center text-sm font-semibold tabular-nums text-texto"
                    >
                      {qtd}
                    </span>
                    <button
                      type="button"
                      onClick={() => mudar(chave, 1)}
                      aria-label={`Somar um kit do tamanho ${linha.tamanho ?? "único"}`}
                      className="flex h-9 w-9 items-center justify-center text-suave transition hover:text-texto"
                    >
                      +
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {exibirVarejo && grade[0] && grade[0].precoKitVarejo > 0 && (
        <p className="mt-3 text-xs leading-relaxed text-suave">
          Revenda sugerida: {reais(grade[0].precoKitVarejo)} o kit
          {pecasNoKit > 1 &&
            ` (${reais(grade[0].precoKitVarejo / pecasNoKit)} por peça)`}{" "}
          — sua margem de referência.
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-borda pt-4">
        <div className="text-sm text-suave">
          {totalKits > 0 ? (
            <>
              <span className="font-semibold text-texto">{totalKits}</span>{" "}
              {totalKits === 1 ? "kit" : "kits"} ·{" "}
              <span className="font-semibold tabular-nums text-texto">
                {reais(totalValor)}
              </span>
            </>
          ) : (
            "Escolha as quantidades"
          )}
        </div>
        <button
          type="button"
          onClick={adicionarTudo}
          disabled={totalKits <= 0}
          className="flex h-11 items-center rounded-full bg-acento px-6 text-sm font-semibold text-white shadow-cta transition duration-200 hover:bg-acento-forte disabled:cursor-not-allowed disabled:shadow-none disabled:opacity-40"
        >
          Adicionar ao pedido
        </button>
      </div>

      <div aria-live="polite">
        {confirmacao && (
          <p className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-ok-fundo px-3 py-2 text-sm font-medium text-ok-texto">
            Adicionado ao pedido!
            <Link href="/carrinho" className="underline underline-offset-2">
              Revisar pedido →
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
