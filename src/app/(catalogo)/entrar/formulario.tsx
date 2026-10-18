"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase/client";

const CLASSE_CAMPO =
  "h-11 w-full rounded-lg border border-borda bg-superficie px-3 text-sm text-texto outline-none transition placeholder:text-tenue focus:border-gale-500";

/**
 * O login roda no navegador porque o @supabase/ssr precisa gravar o cookie de
 * sessão do lado do cliente; o proxy renova a partir daí.
 */
export function FormularioEntrar({ destino }: { destino: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(form: FormData) {
    setErro(null);
    setEnviando(true);

    const supabase = criarClienteNavegador();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("senha") ?? ""),
    });

    if (error) {
      setEnviando(false);
      setErro(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos. Confira e tente de novo."
          : "Não foi possível entrar agora. Tente novamente em instantes.",
      );
      return;
    }

    router.push(destino);
    // O cabeçalho é renderizado no servidor — força a releitura da sessão.
    router.refresh();
  }

  return (
    <form action={entrar} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-texto">
          E-mail
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

      <div>
        <label htmlFor="senha" className="mb-1.5 block text-sm font-medium text-texto">
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className={CLASSE_CAMPO}
        />
      </div>

      {erro && (
        <p role="alert" className="rounded-lg bg-alerta-fundo px-3 py-2 text-sm font-medium text-alerta-texto">
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="h-11 w-full rounded-full bg-acento text-sm font-semibold text-white transition hover:bg-acento-forte disabled:opacity-60"
      >
        {enviando ? "Entrando…" : "Entrar"}
      </button>

      <p className="text-center text-sm">
        <Link
          href="/esqueci-senha"
          className="font-medium text-acento-texto transition hover:text-acento-forte"
        >
          Esqueci minha senha
        </Link>
      </p>
      <p className="text-center text-xs leading-relaxed text-suave">
        Ainda não tem login? Fale com a nossa equipe pelo WhatsApp que a gente
        resolve.
      </p>
    </form>
  );
}
