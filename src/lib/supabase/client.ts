import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./tipos";

/**
 * Cliente para uso no navegador. Usa a chave pública (anon), que é protegida
 * pelas políticas de RLS do banco — ela pode ficar exposta no bundle.
 */
export function criarClienteNavegador() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
