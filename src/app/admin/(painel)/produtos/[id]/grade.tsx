"use client";

import { useState } from "react";
import { CAMPO } from "@/components/cadastro-ui";
import { reais } from "@/lib/formato";
import { NOME_TIPO, TIPOS } from "@/lib/tamanhos";

export type OpcaoTamanho = { id: number; valor: string; tipo: string };

export type LinhaGrade = {
  tamanho_id: number;
  preco_atacado: number | null;
  preco_varejo: number | null;
};

function moeda(v: number | null) {
  return v == null ? "" : v.toFixed(2).replace(".", ",");
}

/**
 * Grade de tamanhos do produto.
 *
 * Preço em branco significa "usa o preço do produto" — que é o caso de 1.387
 * das 1.417 variações do catálogo. Só os tamanhos grandes costumam ter valor
 * próprio, e por isso o campo fica discreto em vez de obrigatório.
 */
export function Grade({
  tamanhos,
  inicial,
  precoKitAtacado,
  pecasNoKit,
}: {
  tamanhos: OpcaoTamanho[];
  inicial: LinhaGrade[];
  precoKitAtacado: number;
  pecasNoKit: number;
}) {
  const [linhas, setLinhas] = useState<LinhaGrade[]>(
    inicial.length ? inicial : [],
  );

  const nome = new Map(tamanhos.map((t) => [t.id, t.valor]));
  const usados = new Set(linhas.map((l) => l.tamanho_id));

  // Agrupado por tipo: a lista herdada tem 120 valores misturando tamanho,
  // numeração de pé, faixa etária, grade e cor. Separar em blocos deixa o
  // seletor navegável sem mudar nada do que o Arthur já conhece.
  const grupos = TIPOS.map((t) => ({
    nome: t.nome,
    itens: tamanhos.filter((x) => x.tipo === t.valor),
  })).filter((g) => g.itens.length);

  function adicionar(id: number) {
    if (!id || usados.has(id)) return;
    setLinhas((l) => [...l, { tamanho_id: id, preco_atacado: null, preco_varejo: null }]);
  }

  function remover(id: number) {
    setLinhas((l) => l.filter((x) => x.tamanho_id !== id));
  }

  function mudarPreco(id: number, campo: "preco_atacado" | "preco_varejo", v: string) {
    const n = v.trim() === "" ? null : Number(v.replace(",", "."));
    setLinhas((l) =>
      l.map((x) =>
        x.tamanho_id === id
          ? { ...x, [campo]: Number.isFinite(n as number) ? n : null }
          : x,
      ),
    );
  }

  return (
    <section className="rounded-xl border border-borda bg-superficie p-5">
      <h2 className="text-sm font-semibold text-texto">Tamanhos disponíveis</h2>
      <p className="mt-1 mb-4 max-w-2xl text-sm leading-relaxed text-suave">
        Escolha os tamanhos que este produto tem. Deixe o preço em branco para
        usar o do produto — só preencha onde o tamanho custar diferente, como
        costuma acontecer nos tamanhos grandes.
      </p>

      {linhas.length > 0 && (
        <div className="mb-3 overflow-hidden rounded-lg border border-borda">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borda bg-superficie-2 text-left text-xs uppercase tracking-wide text-tenue">
                <th className="px-3 py-2 font-medium">Tamanho</th>
                <th className="px-3 py-2 font-medium">Atacado do kit</th>
                <th className="px-3 py-2 font-medium">Varejo do kit</th>
                <th className="px-3 py-2 text-right font-medium">Por peça</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const efetivo = l.preco_atacado ?? precoKitAtacado;
                return (
                  <tr key={l.tamanho_id} className="border-b border-borda last:border-0">
                    <td className="px-3 py-2 font-medium text-texto">
                      {nome.get(l.tamanho_id) ?? "?"}
                      <input type="hidden" name="tamanho_id" value={l.tamanho_id} />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        name="tam_atacado"
                        value={moeda(l.preco_atacado)}
                        onChange={(e) =>
                          mudarPreco(l.tamanho_id, "preco_atacado", e.target.value)
                        }
                        inputMode="decimal"
                        placeholder="usa o do produto"
                        className={`${CAMPO} h-9 tabular-nums`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        name="tam_varejo"
                        value={moeda(l.preco_varejo)}
                        onChange={(e) =>
                          mudarPreco(l.tamanho_id, "preco_varejo", e.target.value)
                        }
                        inputMode="decimal"
                        placeholder="usa o do produto"
                        className={`${CAMPO} h-9 tabular-nums`}
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-suave">
                      {pecasNoKit > 0 ? reais(efetivo / pecasNoKit) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => remover(l.tamanho_id)}
                        aria-label={`Remover ${nome.get(l.tamanho_id)}`}
                        className="rounded-lg px-2 py-1 text-sm text-suave transition hover:bg-acento-texto/10 hover:text-acento-texto"
                      >
                        remover
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value=""
          onChange={(e) => adicionar(Number(e.target.value))}
          aria-label="Adicionar tamanho"
          className={`${CAMPO} h-9 w-64`}
        >
          <option value="">Adicionar tamanho…</option>
          {grupos.map((g) => (
            <optgroup key={g.nome} label={g.nome}>
              {g.itens.map((t) => (
                <option key={t.id} value={t.id} disabled={usados.has(t.id)}>
                  {t.valor}
                  {usados.has(t.id) ? " (já está na grade)" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {linhas.length === 0 && (
          <span className="text-sm text-tenue">
            Sem tamanhos, o produto aparece no catálogo sem opção de escolha.
          </span>
        )}
      </div>

      {linhas.length > 0 && (
        <p className="mt-3 text-xs text-tenue">
          {linhas.length} {linhas.length === 1 ? "tamanho" : "tamanhos"} ·{" "}
          {linhas.filter((l) => l.preco_atacado).length} com preço próprio ·
          tipos: {[...new Set(linhas.map((l) => {
            const t = tamanhos.find((x) => x.id === l.tamanho_id);
            return t ? (NOME_TIPO[t.tipo] ?? t.tipo) : "?";
          }))].join(", ")}
        </p>
      )}
    </section>
  );
}
