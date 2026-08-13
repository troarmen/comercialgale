import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./tipos";

/**
 * Cliente para Server Components, Route Handlers e Server Actions.
 * Ainda usa a chave pública: a identidade vem do cookie de sessão, então o RLS
 * continua valendo. É o cliente padrão do painel.
 */
export async function criarClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component não pode escrever cookie. Tudo bem: o middleware
            // já renovou a sessão antes da requisição chegar aqui.
          }
        },
      },
    },
  );
}

/**
 * Cliente administrativo, com a chave mestra. IGNORA TODAS AS REGRAS DE RLS.
 *
 * Use apenas onde o RLS atrapalha uma operação legítima do painel — criar o
 * login de um cliente, por exemplo, que exige a API de admin do Supabase.
 * NUNCA importe este arquivo em código que rode no navegador.
 */
export function criarClienteAdmin() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");

  return createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
