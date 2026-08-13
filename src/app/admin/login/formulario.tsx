"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { entrar, type EstadoLogin } from "./acoes";

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 flex h-11 w-full items-center justify-center rounded-lg bg-acento text-sm font-semibold text-white transition hover:bg-acento-forte focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export function FormularioLogin({ destino }: { destino: string }) {
  const [estado, acao] = useActionState<EstadoLogin, FormData>(entrar, {});

  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="destino" value={destino} />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-texto">E-mail</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          className="h-11 rounded-lg border border-borda bg-superficie px-3.5 text-sm text-texto outline-none transition placeholder:text-tenue focus:border-gale-500 focus:ring-2 focus:ring-gale-500/25"
          placeholder="voce@comercialgale.com.br"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-texto">Senha</span>
        <input
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 rounded-lg border border-borda bg-superficie px-3.5 text-sm text-texto outline-none transition placeholder:text-tenue focus:border-gale-500 focus:ring-2 focus:ring-gale-500/25"
          placeholder="••••••••"
        />
      </label>

      {estado.erro && (
        <p
          role="alert"
          className="rounded-lg border border-acento-texto/40 bg-acento-texto/10 px-3.5 py-2.5 text-sm text-acento-texto"
        >
          {estado.erro}
        </p>
      )}

      <Botao />
    </form>
  );
}
