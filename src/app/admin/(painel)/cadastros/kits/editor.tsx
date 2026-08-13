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
import { alternarKit, excluirKit, salvarKit, type EstadoKit } from "./acoes";

export type Kit = {
  id: number;
  pecas: number;
  descricao: string;
  ordem: number;
  ativo: boolean;
  usos: number;
};

function Formulario({ kit, aoFechar }: { kit: Kit | "novo"; aoFechar: () => void }) {
  const [estado, acao] = useActionState<EstadoKit, FormData>(salvarKit, {});
  const editando = kit !== "novo";

  return (
    <Modal
      titulo={editando ? "Editar kit" : "Novo kit"}
      aoFechar={aoFechar}
      fecharQuando={!!estado.ok}
    >
      <form action={acao} className="flex flex-col gap-4">
        {editando && <input type="hidden" name="id" value={kit.id} />}

        <label className="flex w-40 flex-col gap-1.5">
          <span className="text-sm font-medium">Peças por kit</span>
          <input
            name="pecas"
            type="number"
            min={1}
            max={999}
            defaultValue={editando ? kit.pecas : ""}
            required
            autoFocus
            className={`${CAMPO} tabular-nums`}
          />
        </label>
        <p className="-mt-2 text-xs leading-relaxed text-tenue">
          O preço que você cadastra no produto é o do kit inteiro. O valor por
          peça o site calcula sozinho.
        </p>

        <label className="flex w-32 flex-col gap-1.5">
          <span className="text-sm font-medium">Ordem</span>
          <input
            name="ordem"
            type="number"
            defaultValue={editando ? kit.ordem : 0}
            className={`${CAMPO} tabular-nums`}
          />
        </label>

        <Interruptor
          nome="ativo"
          marcado={editando ? kit.ativo : true}
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

export function GerenciadorKits({ lista }: { lista: Kit[] }) {
  const [editando, setEditando] = useState<Kit | "novo" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function tentarExcluir(k: Kit) {
    if (!confirm(`Excluir o kit de ${k.pecas} peças?`)) return;
    const r = await excluirKit(k.id);
    setErro(r.erro ?? null);
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <BotaoNovo rotulo="Novo kit" aoClicar={() => setEditando("novo")} />
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
              <th className="px-4 py-3 font-medium">Kit</th>
              <th className="px-4 py-3 text-center font-medium">Produtos</th>
              <th className="px-4 py-3 text-center font-medium">Ordem</th>
              <th className="px-4 py-3 text-center font-medium">Ativo</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((k) => (
              <tr
                key={k.id}
                className="border-b border-borda last:border-0 transition hover:bg-superficie-2"
              >
                <td className="px-4 py-2.5">
                  <span className="font-medium tabular-nums text-texto">
                    {k.pecas}
                  </span>
                  <span className="text-texto">
                    {k.pecas === 1 ? " peça" : " peças"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center tabular-nums text-suave">
                  {k.usos || "—"}
                </td>
                <td className="px-4 py-2.5 text-center tabular-nums text-suave">
                  {k.ordem}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <EtiquetaAtivo
                    ativo={k.ativo}
                    aoAlternar={() => alternarKit(k.id, !k.ativo)}
                  />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => setEditando(k)}
                    className="rounded-lg px-2.5 py-1 text-sm text-suave transition hover:bg-superficie-2 hover:text-texto"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => tentarExcluir(k)}
                    disabled={k.usos > 0}
                    title={k.usos ? "Usado por produtos — desative" : "Excluir"}
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

      {editando && <Formulario kit={editando} aoFechar={() => setEditando(null)} />}
    </>
  );
}
