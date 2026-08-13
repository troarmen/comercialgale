"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  alternarAtivo,
  excluirFabricante,
  salvarFabricante,
  type EstadoFabricante,
} from "./acoes";

export type Fabricante = {
  id: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  /** quantos produtos usam este fabricante — calculado na página */
  usos: number;
};

const CAMPO =
  "h-10 w-full rounded-lg border border-borda bg-superficie px-3 text-sm text-texto outline-none transition placeholder:text-tenue focus:border-gale-500";

function Confirmar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-lg bg-acento px-5 text-sm font-semibold text-white transition hover:bg-acento-forte disabled:opacity-60"
    >
      {pending ? "Salvando…" : "Salvar"}
    </button>
  );
}

function Dialogo({
  fabricante,
  aoFechar,
}: {
  fabricante: Fabricante | "novo";
  aoFechar: () => void;
}) {
  const [estado, acao] = useActionState<EstadoFabricante, FormData>(
    salvarFabricante,
    {},
  );
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  // Fecha sozinho quando a gravação dá certo
  useEffect(() => {
    if (estado.ok) aoFechar();
  }, [estado.ok, aoFechar]);

  const editando = fabricante !== "novo";

  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl bg-superficie p-0 text-texto backdrop:bg-black/50"
    >
      <form action={acao} className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">
          {editando ? "Editar fabricante" : "Novo fabricante"}
        </h2>

        {editando && <input type="hidden" name="id" value={fabricante.id} />}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Nome</span>
          <input
            name="nome"
            defaultValue={editando ? fabricante.nome : ""}
            required
            autoFocus
            maxLength={120}
            placeholder="Ex: Bruna Lian"
            className={CAMPO}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Descrição</span>
          <textarea
            name="descricao"
            defaultValue={editando ? (fabricante.descricao ?? "") : ""}
            rows={2}
            placeholder="Opcional. Uma nota interna sobre a marca."
            className={`${CAMPO} h-auto py-2.5`}
          />
        </label>

        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            name="ativo"
            defaultChecked={editando ? fabricante.ativo : true}
            className="peer sr-only"
          />
          <span className="relative h-6 w-11 rounded-full bg-borda-forte transition peer-checked:bg-acento">
            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
          </span>
          <span className="text-sm">Aparece no catálogo</span>
        </label>

        {estado.erro && (
          <p role="alert" className="text-sm font-medium text-acento-texto">
            {estado.erro}
          </p>
        )}

        <div className="mt-1 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={aoFechar}
            className="h-10 rounded-lg px-4 text-sm text-suave transition hover:bg-superficie-2 hover:text-texto"
          >
            Cancelar
          </button>
          <Confirmar />
        </div>
      </form>
    </dialog>
  );
}

export function GerenciadorFabricantes({ lista }: { lista: Fabricante[] }) {
  const [editando, setEditando] = useState<Fabricante | "novo" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function tentarExcluir(f: Fabricante) {
    if (!confirm(`Excluir "${f.nome}"? Esta ação não pode ser desfeita.`)) return;
    const r = await excluirFabricante(f.id);
    setErro(r.erro ?? null);
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setEditando("novo")}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-acento px-3.5 text-sm font-semibold text-white transition hover:bg-acento-forte"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
            <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Novo fabricante
        </button>
      </div>

      {erro && (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-acento-texto/40 bg-acento-texto/10 px-3.5 py-2.5 text-sm text-acento-texto"
        >
          {erro}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-borda bg-superficie">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-tenue">
              <th className="px-4 py-3 font-medium">Fabricante</th>
              <th className="px-4 py-3 text-center font-medium">Produtos</th>
              <th className="px-4 py-3 text-center font-medium">No catálogo</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((f) => {
              const usos = f.usos;
              return (
                <tr
                  key={f.id}
                  className="border-b border-borda last:border-0 transition hover:bg-superficie-2"
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-texto">{f.nome}</div>
                    {f.descricao && (
                      <div className="truncate text-xs text-suave">
                        {f.descricao}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center tabular-nums">
                    {usos ? (
                      <span className="text-suave">{usos}</span>
                    ) : (
                      <span className="rounded-full bg-alerta-fundo px-2 py-0.5 text-xs font-medium text-alerta-texto">
                        nenhum
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => alternarAtivo(f.id, !f.ativo)}
                      title={f.ativo ? "Esconder do catálogo" : "Mostrar no catálogo"}
                      className="cursor-pointer"
                    >
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition ${
                          f.ativo
                            ? "bg-ok-fundo text-ok-texto"
                            : "bg-tenue/15 text-suave"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${f.ativo ? "bg-ok-texto" : "bg-tenue"}`}
                        />
                        {f.ativo ? "Sim" : "Não"}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => setEditando(f)}
                      className="rounded-lg px-2.5 py-1 text-sm text-suave transition hover:bg-superficie-2 hover:text-texto"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => tentarExcluir(f)}
                      disabled={usos > 0}
                      title={
                        usos
                          ? "Tem produtos ligados — desative em vez de excluir"
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
        <Dialogo fabricante={editando} aoFechar={() => setEditando(null)} />
      )}
    </>
  );
}
