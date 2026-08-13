"use client";

import { useActionState, useState, useTransition } from "react";
import {
  Aviso,
  BotaoCancelar,
  BotaoNovo,
  BotaoSalvar,
  CAMPO,
  EtiquetaAtivo,
  Interruptor,
  Modal,
} from "@/components/cadastro-ui";
import { NOME_TIPO, TIPOS } from "@/lib/tamanhos";
import {
  alternarTamanho,
  excluirTamanho,
  reclassificar,
  salvarTamanho,
  type EstadoTamanho,
} from "./acoes";

export type Tamanho = {
  id: number;
  valor: string;
  tipo: string;
  ordem: number;
  ativo: boolean;
  usos: number;
};

function Formulario({
  tamanho,
  aoFechar,
}: {
  tamanho: Tamanho | "novo";
  aoFechar: () => void;
}) {
  const [estado, acao] = useActionState<EstadoTamanho, FormData>(
    salvarTamanho,
    {},
  );
  const editando = tamanho !== "novo";

  return (
    <Modal
      titulo={editando ? "Editar tamanho" : "Novo tamanho"}
      aoFechar={aoFechar}
      fecharQuando={!!estado.ok}
    >
      <form action={acao} className="flex flex-col gap-4">
        {editando && <input type="hidden" name="id" value={tamanho.id} />}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Valor</span>
          <input
            name="valor"
            defaultValue={editando ? tamanho.valor : ""}
            required
            autoFocus
            maxLength={40}
            placeholder="Ex: GG"
            className={CAMPO}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Tipo</span>
          <select
            name="tipo"
            defaultValue={editando ? tamanho.tipo : "tamanho"}
            className={CAMPO}
          >
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.nome}
                {t.exemplo && ` — ${t.exemplo}`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex w-32 flex-col gap-1.5">
          <span className="text-sm font-medium">Ordem</span>
          <input
            name="ordem"
            type="number"
            defaultValue={editando ? tamanho.ordem : 0}
            className={`${CAMPO} tabular-nums`}
          />
        </label>

        <Interruptor
          nome="ativo"
          marcado={editando ? tamanho.ativo : true}
          rotulo="Disponível para uso"
        />

        {estado.erro && <Aviso mensagem={estado.erro} />}

        <div className="mt-1 flex items-center justify-end gap-2">
          <BotaoCancelar aoClicar={aoFechar} />
          <BotaoSalvar />
        </div>
      </form>
    </Modal>
  );
}

export function GerenciadorTamanhos({ lista }: { lista: Tamanho[] }) {
  const [editando, setEditando] = useState<Tamanho | "novo" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [pendente, iniciar] = useTransition();

  function alternarMarca(id: number) {
    setMarcados((m) => {
      const novo = new Set(m);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function tentarExcluir(t: Tamanho) {
    if (!confirm(`Excluir "${t.valor}"?`)) return;
    const r = await excluirTamanho(t.id);
    setErro(r.erro ?? null);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {marcados.size > 0 ? (
          /*
           * Reclassificação em lote. A lista herdada mistura cor e grade dentro
           * de "tamanho"; corrigir um por um seriam 120 cliques.
           */
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-borda bg-superficie px-3 py-2">
            <span className="text-sm text-texto">
              {marcados.size} selecionado{marcados.size > 1 ? "s" : ""} — mudar tipo para:
            </span>
            {TIPOS.filter((t) => t.valor !== "outro").map((t) => (
              <button
                key={t.valor}
                type="button"
                disabled={pendente}
                onClick={() =>
                  iniciar(async () => {
                    const r = await reclassificar([...marcados], t.valor);
                    setErro(r.erro ?? null);
                    if (!r.erro) setMarcados(new Set());
                  })
                }
                className="h-8 rounded-lg border border-borda px-2.5 text-xs font-medium text-texto transition hover:bg-superficie-2 disabled:opacity-50"
              >
                {t.nome}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMarcados(new Set())}
              className="h-8 rounded-lg px-2.5 text-xs text-suave transition hover:text-texto"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <span className="text-sm text-suave">
            Marque vários para reclassificar de uma vez.
          </span>
        )}
        <BotaoNovo rotulo="Novo tamanho" aoClicar={() => setEditando("novo")} />
      </div>

      {erro && (
        <div className="mb-3">
          <Aviso mensagem={erro} />
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-borda bg-superficie">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-tenue">
              <th className="w-10 px-4 py-3" />
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 text-center font-medium">Produtos</th>
              <th className="px-4 py-3 text-center font-medium">Ativo</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((t) => (
              <tr
                key={t.id}
                className={`border-b border-borda last:border-0 transition ${
                  marcados.has(t.id) ? "bg-acento-texto/5" : "hover:bg-superficie-2"
                }`}
              >
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={marcados.has(t.id)}
                    onChange={() => alternarMarca(t.id)}
                    aria-label={`Selecionar ${t.valor}`}
                    className="h-4 w-4 accent-[var(--acento)]"
                  />
                </td>
                <td className="px-4 py-2 font-medium text-texto">{t.valor}</td>
                <td className="px-4 py-2 text-suave">
                  {NOME_TIPO[t.tipo] ?? t.tipo}
                </td>
                <td className="px-4 py-2 text-center tabular-nums text-suave">
                  {t.usos || "—"}
                </td>
                <td className="px-4 py-2 text-center">
                  <EtiquetaAtivo
                    ativo={t.ativo}
                    aoAlternar={() => alternarTamanho(t.id, !t.ativo)}
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setEditando(t)}
                    className="rounded-lg px-2.5 py-1 text-sm text-suave transition hover:bg-superficie-2 hover:text-texto"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => tentarExcluir(t)}
                    disabled={t.usos > 0}
                    title={t.usos ? "Usado por produtos — desative" : "Excluir"}
                    className="rounded-lg px-2.5 py-1 text-sm text-suave transition hover:bg-acento-texto/10 hover:text-acento-texto disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-suave"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando && (
        <Formulario tamanho={editando} aoFechar={() => setEditando(null)} />
      )}
    </>
  );
}
