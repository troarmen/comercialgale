"use client";

import { useState, useTransition } from "react";
import { ORDEM_STATUS, STATUS, type StatusPedido } from "@/lib/pedidos";
import { confirmarVinculo, mudarStatus, salvarObservacao } from "./acoes";

export function TrocarStatus({
  id,
  atual,
}: {
  id: number;
  atual: StatusPedido;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-tenue">
        Situação
      </label>
      <select
        value={atual}
        disabled={pendente}
        onChange={(e) =>
          iniciar(async () => {
            const r = await mudarStatus(id, e.target.value as StatusPedido);
            setErro(r.erro ?? null);
          })
        }
        className="h-10 rounded-lg border border-borda bg-superficie px-3 text-sm font-medium text-texto outline-none transition focus:border-gale-500 disabled:opacity-60"
      >
        {ORDEM_STATUS.map((s) => (
          <option key={s} value={s}>
            {STATUS[s].nome}
          </option>
        ))}
      </select>
      {erro && <p className="text-xs text-acento-texto">{erro}</p>}
    </div>
  );
}

export function Observacao({
  id,
  inicial,
}: {
  id: number;
  inicial: string;
}) {
  const [texto, setTexto] = useState(inicial);
  const [pendente, iniciar] = useTransition();
  const [salvo, setSalvo] = useState(false);

  const mudou = texto !== inicial;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium uppercase tracking-wide text-tenue">
        Anotações internas
      </label>
      <textarea
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setSalvo(false);
        }}
        rows={4}
        placeholder="O que foi combinado com o cliente, forma de pagamento, prazo…"
        className="rounded-lg border border-borda bg-superficie px-3 py-2.5 text-sm text-texto outline-none transition placeholder:text-tenue focus:border-gale-500"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!mudou || pendente}
          onClick={() =>
            iniciar(async () => {
              await salvarObservacao(id, texto);
              setSalvo(true);
            })
          }
          className="h-9 rounded-lg bg-acento px-4 text-sm font-semibold text-white transition hover:bg-acento-forte disabled:opacity-40"
        >
          {pendente ? "Salvando…" : "Salvar anotação"}
        </button>
        {salvo && !mudou && (
          <span className="text-sm text-ok-texto">Salvo.</span>
        )}
      </div>
      <p className="text-xs text-tenue">
        Só o painel vê isto. O cliente nunca tem acesso.
      </p>
    </div>
  );
}

export function AvisoVinculo({ id }: { id: number }) {
  const [pendente, iniciar] = useTransition();
  const [sumiu, setSumiu] = useState(false);
  if (sumiu) return null;

  return (
    <div className="mb-5 rounded-xl border border-alerta-texto/30 bg-alerta-fundo p-4">
      <p className="text-sm font-medium text-alerta-texto">
        Cliente deduzido na migração
      </p>
      <p className="mt-1 text-sm leading-relaxed text-alerta-texto/90">
        O sistema antigo guardava só o nome do cliente neste pedido, e existem
        dois cadastros com esse mesmo nome. Vinculamos ao mais antigo. Se estiver
        certo, confirme; se não, é só trocar o cliente do cadastro.
      </p>
      <button
        type="button"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            await confirmarVinculo(id);
            setSumiu(true);
          })
        }
        className="mt-3 h-9 rounded-lg border border-alerta-texto/40 px-3.5 text-sm font-medium text-alerta-texto transition hover:bg-alerta-texto/10 disabled:opacity-50"
      >
        {pendente ? "Confirmando…" : "Está correto"}
      </button>
    </div>
  );
}
