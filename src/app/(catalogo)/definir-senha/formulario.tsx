"use client";

import Link from "next/link";
import { useActionState } from "react";
import { definirSenha, type EstadoSenha } from "./acoes";

const CLASSE_CAMPO =
  "h-11 w-full rounded-lg border border-borda bg-superficie px-3 text-sm text-texto outline-none transition placeholder:text-tenue focus:border-gale-500";

export function FormularioSenha({ token }: { token: string | null }) {
  const [estado, enviar, pendente] = useActionState<EstadoSenha, FormData>(
    definirSenha,
    {},
  );

  if (estado.linkInvalido) {
    return (
      <div className="text-center">
        <p role="alert" className="text-sm font-medium text-texto">
          Este link expirou ou já foi usado.
        </p>
        <p className="mt-1 text-sm text-suave">
          Os links valem por 1 hora e funcionam uma vez só.
        </p>
        <Link
          href="/esqueci-senha"
          className="mt-4 inline-flex h-11 items-center rounded-full bg-acento px-6 text-sm font-semibold text-white transition hover:bg-acento-forte"
        >
          Pedir um link novo
        </Link>
      </div>
    );
  }

  return (
    <form action={enviar} className="space-y-4">
      {token && <input type="hidden" name="token_hash" value={token} />}

      <div>
        <label htmlFor="senha" className="mb-1.5 block text-sm font-medium text-texto">
          Nova senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={CLASSE_CAMPO}
        />
        <p className="mt-1 text-xs text-suave">Pelo menos 8 caracteres.</p>
      </div>

      <div>
        <label htmlFor="confirmacao" className="mb-1.5 block text-sm font-medium text-texto">
          Repita a nova senha
        </label>
        <input
          id="confirmacao"
          name="confirmacao"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={CLASSE_CAMPO}
        />
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
        {pendente ? "Salvando…" : "Salvar senha e entrar"}
      </button>
    </form>
  );
}
