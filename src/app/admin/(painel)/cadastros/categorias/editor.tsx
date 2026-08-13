"use client";

import { useActionState, useState } from "react";
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
import {
  alternarCategoria,
  excluirCategoria,
  salvarCategoria,
  type EstadoCategoria,
} from "./acoes";

export type Categoria = {
  id: number;
  nome: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
  produtos: number;
  subcategorias: number;
};

function Formulario({
  categoria,
  aoFechar,
}: {
  categoria: Categoria | "nova";
  aoFechar: () => void;
}) {
  const [estado, acao] = useActionState<EstadoCategoria, FormData>(
    salvarCategoria,
    {},
  );
  const editando = categoria !== "nova";

  return (
    <Modal
      titulo={editando ? "Editar categoria" : "Nova categoria"}
      aoFechar={aoFechar}
      fecharQuando={!!estado.ok}
    >
      <form action={acao} className="flex flex-col gap-4">
        {editando && <input type="hidden" name="id" value={categoria.id} />}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Nome</span>
          <input
            name="nome"
            defaultValue={editando ? categoria.nome : ""}
            required
            autoFocus
            maxLength={80}
            placeholder="Ex: Lingerie"
            className={CAMPO}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Descrição</span>
          <textarea
            name="descricao"
            defaultValue={editando ? (categoria.descricao ?? "") : ""}
            rows={2}
            placeholder="Opcional."
            className={`${CAMPO} h-auto py-2.5`}
          />
        </label>

        <label className="flex w-32 flex-col gap-1.5">
          <span className="text-sm font-medium">Ordem</span>
          <input
            name="ordem"
            type="number"
            defaultValue={editando ? categoria.ordem : 0}
            className={`${CAMPO} tabular-nums`}
          />
          <span className="text-xs text-tenue">Menor aparece primeiro.</span>
        </label>

        <Interruptor
          nome="ativo"
          marcado={editando ? categoria.ativo : true}
          rotulo="Aparece no catálogo"
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

export function GerenciadorCategorias({ lista }: { lista: Categoria[] }) {
  const [editando, setEditando] = useState<Categoria | "nova" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function tentarExcluir(c: Categoria) {
    if (!confirm(`Excluir "${c.nome}"? Esta ação não pode ser desfeita.`)) return;
    const r = await excluirCategoria(c.id);
    setErro(r.erro ?? null);
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <BotaoNovo rotulo="Nova categoria" aoClicar={() => setEditando("nova")} />
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
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 text-center font-medium">Ordem</th>
              <th className="px-4 py-3 text-center font-medium">Subcategorias</th>
              <th className="px-4 py-3 text-center font-medium">Produtos</th>
              <th className="px-4 py-3 text-center font-medium">No catálogo</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => {
              const bloqueado = c.produtos > 0 || c.subcategorias > 0;
              return (
                <tr
                  key={c.id}
                  className="border-b border-borda last:border-0 transition hover:bg-superficie-2"
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-texto">{c.nome}</div>
                    {c.descricao && (
                      <div className="truncate text-xs text-suave">{c.descricao}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-suave">
                    {c.ordem}
                  </td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-suave">
                    {c.subcategorias || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-suave">
                    {c.produtos || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <EtiquetaAtivo
                      ativo={c.ativo}
                      aoAlternar={() => alternarCategoria(c.id, !c.ativo)}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => setEditando(c)}
                      className="rounded-lg px-2.5 py-1 text-sm text-suave transition hover:bg-superficie-2 hover:text-texto"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => tentarExcluir(c)}
                      disabled={bloqueado}
                      title={
                        bloqueado
                          ? "Tem produtos ou subcategorias ligados — desative em vez de excluir"
                          : "Excluir"
                      }
                      className="rounded-lg px-2.5 py-1 text-sm text-suave transition hover:bg-acento-texto/10 hover:text-acento-texto disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-suave"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editando && (
        <Formulario categoria={editando} aoFechar={() => setEditando(null)} />
      )}
    </>
  );
}
