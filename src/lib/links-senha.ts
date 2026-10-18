import { criarClienteAdmin } from "@/lib/supabase/server";

/**
 * Link de uso único para criar/trocar a senha — usado no "esqueci minha
 * senha", no reenvio pelo painel e nos convites (acesso liberado, equipe).
 *
 * POR QUE generateLink + link próprio, e não resetPasswordForEmail:
 *   • o e-mail sai pelo NOSSO SMTP (Brevo), com o nosso texto — não depende
 *     do template nem do SMTP do Supabase Auth;
 *   • o resetPasswordForEmail com @supabase/ssr usa PKCE: o "verificador"
 *     fica num cookie do navegador que PEDIU. Quando o Arthur pede pelo
 *     painel, o link só funcionaria no navegador dele. O token_hash abaixo
 *     funciona em qualquer navegador.
 *
 * O link abre /definir-senha, que só mostra o formulário: o token é trocado
 * por sessão quando a pessoa ENVIA a nova senha (POST). Filtros de e-mail
 * corporativo (Outlook Safe Links etc.) abrem os links para inspecionar — se
 * a simples abertura consumisse o token, o lojista receberia "link expirado".
 *
 * Devolve null se o e-mail não tiver conta ou o Auth falhar.
 * NUNCA importe em código que rode no navegador (usa a service_role).
 */
export async function gerarLinkSenha(email: string) {
  const { data, error } = await criarClienteAdmin().auth.admin.generateLink({
    type: "recovery",
    email: email.trim().toLowerCase(),
  });
  if (error || !data.properties?.hashed_token) return null;

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.comercialgale.com.br";
  const url = new URL("/definir-senha", site);
  url.searchParams.set("token_hash", data.properties.hashed_token);
  url.searchParams.set("type", "recovery");
  return { link: url.toString(), nome: (data.user.user_metadata?.nome as string | undefined) ?? null };
}

/**
 * Trava de 60 s por e-mail (migração 009): o generateLink não tem limite de
 * frequência próprio. Em dúvida (função ausente, erro), libera — melhor um
 * e-mail a mais do que lojista sem conseguir entrar.
 */
export async function linkSenhaLiberado(email: string) {
  const { data, error } = await criarClienteAdmin().rpc("link_senha_liberado", {
    p_email: email,
  });
  if (error) {
    console.error("[senha] trava de reenvio indisponível:", error.message);
    return true;
  }
  return data !== false;
}
