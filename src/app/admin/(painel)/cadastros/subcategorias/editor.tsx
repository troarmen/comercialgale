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
  alternarSubcategoria,
  excluirSubcategoria,
  salvarSubcategoria,
  type EstadoSubcategoria,
} from "./acoes";

export type Categoria = { id: number; nome: string };

export type Subcategoria = {
  id: number;
  categoria_id: number;
  nome: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
  produtos: number;
};

function Formulario({
  sub,
  categorias,
  categoriaPadrao,
  aoFechar,
}: {
  sub: Subcategoria | "nova";
  categorias: Categoria[];
  categoriaPadrao: number | null;
  aoFechar: () => void;
}) {
  const [estado, acao] = useActionState<EstadoSubcategoria, FormData>(
    salvarSubcategoria,
    {},
  );
  const editando = sub !== "nova";

  return (
    <Modal
      titulo={editando ? "Editar subcategoria" : "Nova subcategoria"}
      aoFechar={aoFechar}
      fecharQuando={!!estado.ok}
    >
      <form action={acao} className="flex flex-col gap-4">
        {editando && <input type="hidden" name="id" value={sub.id} />}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Categoria</span>
          <select
            name="categoria_id"
            defaultValue={editando ? sub.categoria_id : (categoriaPadrao ?? "")}
            required
            className={CAMPO}
          >
            <option value="">Escolha…</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Nome</span>
          <input
            name="nome"
            defaultValue={editando ? sub.nome : ""}
            required
            autoFocus
            maxLength={80}
            placeholder="Ex: Sutiãs Adultos"
            className={CAMPO}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Descrição</span>
          <textarea
            name="descricao"
            defaultValue={editando ? (sub.descricao ?? "") : ""}
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
            defaultValue={editando ? sub.ordem : 0}
            className={`${CAMPO} tabular-nums`}
          />
        </label>

        <Interruptor
          nome="ativo"
          marcado={editando ? sub.ativo : true}
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

export function GerenciadorSubcategorias({
  categorias,
  lista,
  categoriaFiltrada,
}: {
  categorias: Categoria[];
  lista: Subcategoria[];
  categoriaFiltrada: number | null;
}) {
  const [editando, setEditando] = useState<Subcategoria | "nova" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function tentarExcluir(s: Subcategoria) {
    if (!confirm(`Excluir "${s.nome}"? Esta ação não pode ser desfeita.`)) return;
    const r = await excluirSubcategoria(s.id);
    setErro(r.erro ?? null);
  }

  const nomeCategoria = new Map(categorias.map((c) => [c.id, c.nome]));

  return (
    <>
      <div className="mb-4 flex justify-end">
        <BotaoNovo rotulo="Nova subcategoria" aoClicar={() => setEditando("nova")} />
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
              <th className="px-4 py-3 font-medium">Subcategoria</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 text-center font-medium">Ordem</th>
              <th className="px-4 py-3 text-center font-medium">Produtos</th>
              <th className="px-4 py-3 text-center font-medium">No catálogo</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((s) => (
              <tr
                key={s.id}
                className="border-b border-borda last:border-0 transition hover:bg-superficie-2"
              >
                <td className="px-4 py-2.5">
                  <div className="font-medium text-texto">{s.nome}</div>
                  {s.descricao && (
                    <div className="truncate text-xs text-suave">{s.descricao}</div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-suave">
                  {nomeCategoria.get(s.categoria_id) ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-center tabular-nums text-suave">
                  {s.ordem}
                </td>
                <td className="px-4 py-2.5 text-center tabular-nums">
                  {s.produtos ? (
                    <span className="text-suave">{s.produtos}</span>
                  ) : (
                    <span className="rounded-full bg-alerta-fundo px-2 py-0.5 text-xs font-medium text-alerta-texto">
                      nenhum
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <EtiquetaAtivo
                    ativo={s.ativo}
                    aoAlternar={() => alternarSubcategoria(s.id, !s.ativo)}
                  />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => setEditando(s)}
                    className="rounded-lg px-2.5 py-1 text-sm text-suave transition hover:bg-superficie-2 hover:text-texto"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => tentarExcluir(s)}
                    disabled={s.produtos > 0}
                    title={
                      s.produtos
                        ? "Tem produtos ligados — desative em vez de excluir"
                        : "Excluir"
                    }
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
        <Formulario
          sub={editando}
          categorias={categorias}
          categoriaPadrao={categoriaFiltrada}
          aoFechar={() => setEditando(null)}
        />
      )}
    </>
  );
}
