import { enviarLinkSenha, urlDosLinks, type MotivoLinkSenha } from "@/lib/email";
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

  const url = new URL("/definir-senha", urlDosLinks());
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

export type ResultadoConvite =
  | { emailEnviado: true }
  | { emailEnviado: false; link: string }
  | { erro: string };

/**
 * Gera o link e manda por e-mail. Se o e-mail não sair (SMTP fora, caixa
 * recusou), devolve o LINK para a tela do painel mostrar — o Arthur copia e
 * manda por WhatsApp. Nunca deixa quem está no painel sem saída.
 */
export async function convidarComLink(
  email: string,
  motivo: MotivoLinkSenha,
): Promise<ResultadoConvite> {
  const gerado = await gerarLinkSenha(email);
  if (!gerado) return { erro: "Não foi possível gerar o link de acesso." };
  const enviado = await enviarLinkSenha(email, gerado.nome, gerado.link, motivo);
  return enviado ? { emailEnviado: true } : { emailEnviado: false, link: gerado.link };
}
