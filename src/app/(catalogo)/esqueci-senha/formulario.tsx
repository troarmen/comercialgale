"use client";

import { useActionState } from "react";
import { pedirLinkSenha, type EstadoEsqueci } from "./acoes";

const CLASSE_CAMPO =
  "h-11 w-full rounded-lg border border-borda bg-superficie px-3 text-sm text-texto outline-none transition placeholder:text-tenue focus:border-gale-500";

export function FormularioEsqueci() {
  const [estado, enviar, pendente] = useActionState<EstadoEsqueci, FormData>(
    pedirLinkSenha,
    {},
  );

  if (estado.enviadoPara) {
    return (
      <div role="status" className="text-center">
        <p className="text-sm font-medium text-texto">Confira a sua caixa de entrada.</p>
        <p className="mt-2 text-sm leading-relaxed text-suave">
          Se <strong className="font-medium text-texto">{estado.enviadoPara}</strong>{" "}
          tiver conta na Galé, chega em instantes um e-mail com o link para criar
          a nova senha. Olhe também o spam.
        </p>
        <p className="mt-4 text-xs text-suave">
          Não chegou em alguns minutos? Fale com a nossa equipe pelo WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <form action={enviar} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-texto">
          E-mail da conta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="voce@sualoja.com.br"
          className={CLASSE_CAMPO}
        />
      </div>

      {/* Honeypot: invisível para pessoas, irresistível para robôs. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Site
          <input name="site" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {estado.erro && (
        <p role="alert" className="rounded-lg bg-alerta-fundo px-3 py-2 text-sm font-medium text-alerta-texto">
          {estado.erro}
        </p>
      )}

      <button
        type="submit"
        disabled={pendente}
        className="h-11 w-full rounded-full bg-acento text-sm font-semibold text-white transition hover:bg-acento-forte disabled:opacity-60"
      >
        {pendente ? "Enviando…" : "Enviar link"}
      </button>
    </form>
  );
}
