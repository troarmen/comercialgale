"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

/** Estilo único dos campos das telas de cadastro. */
export const CAMPO =
  "h-10 w-full rounded-lg border border-borda bg-superficie px-3 text-sm text-texto outline-none transition placeholder:text-tenue focus:border-gale-500";

export function BotaoSalvar({ rotulo = "Salvar" }: { rotulo?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-lg bg-acento px-5 text-sm font-semibold text-white transition hover:bg-acento-forte disabled:opacity-60"
    >
      {pending ? "Salvando…" : rotulo}
    </button>
  );
}

export function BotaoNovo({
  rotulo,
  aoClicar,
}: {
  rotulo: string;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className="flex h-9 items-center gap-1.5 rounded-lg bg-acento px-3.5 text-sm font-semibold text-white transition hover:bg-acento-forte"
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
        <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      {rotulo}
    </button>
  );
}

/** Interruptor de ativo/inativo usado em todos os cadastros. */
export function Interruptor({
  nome,
  marcado,
  rotulo,
}: {
  nome: string;
  marcado: boolean;
  rotulo: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <input type="checkbox" name={nome} defaultChecked={marcado} className="peer sr-only" />
      <span className="relative h-6 w-11 rounded-full bg-borda-forte transition peer-checked:bg-acento">
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
      </span>
      <span className="text-sm">{rotulo}</span>
    </label>
  );
}

/** Etiqueta de situação, clicável para alternar. */
export function EtiquetaAtivo({
  ativo,
  aoAlternar,
}: {
  ativo: boolean;
  aoAlternar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoAlternar}
      title={ativo ? "Esconder do catálogo" : "Mostrar no catálogo"}
      className="cursor-pointer"
    >
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition ${
          ativo ? "bg-ok-fundo text-ok-texto" : "bg-tenue/15 text-suave"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${ativo ? "bg-ok-texto" : "bg-tenue"}`} />
        {ativo ? "Sim" : "Não"}
      </span>
    </button>
  );
}

/**
 * Janela modal dos formulários de cadastro. Usa o <dialog> nativo, que já traz
 * de graça o fechamento com Esc, o foco preso dentro e o fundo escurecido.
 */
export function Modal({
  titulo,
  aoFechar,
  fecharQuando,
  children,
}: {
  titulo: string;
  aoFechar: () => void;
  fecharQuando: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  useEffect(() => {
    if (fecharQuando) aoFechar();
  }, [fecharQuando, aoFechar]);

  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl bg-superficie p-0 text-texto backdrop:bg-black/50"
    >
      <div className="p-6">
        <h2 className="mb-4 text-lg font-semibold">{titulo}</h2>
        {children}
      </div>
    </dialog>
  );
}

export function BotaoCancelar({ aoClicar }: { aoClicar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className="h-10 rounded-lg px-4 text-sm text-suave transition hover:bg-superficie-2 hover:text-texto"
    >
      Cancelar
    </button>
  );
}

export function Aviso({ mensagem }: { mensagem: string }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-acento-texto/40 bg-acento-texto/10 px-3.5 py-2.5 text-sm text-acento-texto"
    >
      {mensagem}
    </p>
  );
}
