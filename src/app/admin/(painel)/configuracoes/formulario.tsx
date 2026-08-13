"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { salvarConfiguracoes, type EstadoConfig } from "./acoes";

const CAMPO =
  "h-10 w-full rounded-lg border border-borda bg-superficie px-3 text-sm text-texto outline-none transition placeholder:text-tenue focus:border-gale-500";

function Salvar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-lg bg-acento px-5 text-sm font-semibold text-white transition hover:bg-acento-forte disabled:opacity-60"
    >
      {pending ? "Salvando…" : "Salvar alterações"}
    </button>
  );
}

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-borda bg-superficie p-5">
      <h2 className="text-sm font-semibold text-texto">{titulo}</h2>
      <p className="mt-1 mb-4 max-w-xl text-sm leading-relaxed text-suave">
        {descricao}
      </p>
      {children}
    </section>
  );
}

export function FormularioConfiguracoes({
  minimo,
  emails,
  aviso,
  exibirVarejo,
}: {
  minimo: number;
  emails: string[];
  aviso: string;
  exibirVarejo: boolean;
}) {
  const [estado, acao] = useActionState<EstadoConfig, FormData>(
    salvarConfiguracoes,
    {},
  );
  const [contador, setContador] = useState(aviso.length);

  return (
    <form action={acao} className="flex max-w-3xl flex-col gap-4">
      <Secao
        titulo="Pedido mínimo"
        descricao="Valor abaixo do qual o cliente não consegue fechar o pedido. Deixe em branco ou zero para não exigir mínimo."
      >
        <div className="relative w-48">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-suave">
            R$
          </span>
          <input
            name="pedido_minimo_valor"
            defaultValue={minimo ? minimo.toFixed(2).replace(".", ",") : ""}
            inputMode="decimal"
            placeholder="0,00"
            aria-label="Valor mínimo do pedido em reais"
            className={`${CAMPO} pl-9 tabular-nums`}
          />
        </div>
      </Secao>

      <Secao
        titulo="Aviso para os pedidos"
        descricao="Quem recebe uma cópia por e-mail a cada pedido novo. Um endereço por linha. O cliente que fez o pedido também recebe, sempre."
      >
        <textarea
          name="emails_notificacao"
          defaultValue={emails.join("\n")}
          rows={3}
          placeholder="contato@comercialgale.com.br"
          aria-label="E-mails que recebem cópia dos pedidos"
          className={`${CAMPO} h-auto py-2.5 font-mono text-[13px] leading-relaxed`}
        />
      </Secao>

      <Secao
        titulo="Preço de revenda sugerido"
        descricao="Mostra ao lojista, ao lado do preço de atacado, por quanto ele pode revender a peça. Desligar esconde essa coluna do catálogo — os pedidos antigos continuam guardando o valor."
      >
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="exibir_preco_varejo"
            defaultChecked={exibirVarejo}
            className="peer sr-only"
          />
          <span className="relative h-6 w-11 rounded-full bg-borda-forte transition peer-checked:bg-acento peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gale-500">
            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
          </span>
          <span className="text-sm text-texto">
            Exibir preço de revenda no catálogo
          </span>
        </label>
      </Secao>

      <Secao
        titulo="Aviso no topo do catálogo"
        descricao="Uma linha exibida para todos os clientes assim que entram. Serve para avisar de férias coletivas, prazo de entrega ou uma promoção. Deixe vazio para não mostrar nada."
      >
        <textarea
          name="catalogo_aviso"
          defaultValue={aviso}
          onChange={(e) => setContador(e.target.value.length)}
          rows={2}
          maxLength={280}
          placeholder="Ex: Entregas suspensas entre 20 e 30 de dezembro."
          aria-label="Aviso exibido no topo do catálogo"
          className={`${CAMPO} h-auto py-2.5`}
        />
        <p className="mt-1.5 text-right text-xs tabular-nums text-tenue">
          {contador}/280
        </p>
      </Secao>

      <div className="flex items-center gap-3">
        <Salvar />
        {estado.ok && (
          <span role="status" className="text-sm font-medium text-ok-texto">
            Alterações salvas.
          </span>
        )}
        {estado.erro && (
          <span role="alert" className="text-sm font-medium text-acento-texto">
            {estado.erro}
          </span>
        )}
      </div>
    </form>
  );
}
