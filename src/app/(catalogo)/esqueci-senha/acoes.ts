"use server";

import { enviarLinkSenha } from "@/lib/email";
import { gerarLinkSenha, linkSenhaLiberado } from "@/lib/links-senha";

export type EstadoEsqueci = { erro?: string; enviadoPara?: string };

const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

/**
 * A resposta é SEMPRE a mesma, tenha o e-mail conta ou não: dizer "este
 * e-mail não existe" entregaria a quem tenta invadir quais contas são válidas.
 */
export async function pedirLinkSenha(
  _anterior: EstadoEsqueci,
  form: FormData,
): Promise<EstadoEsqueci> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { erro: "Confira o e-mail digitado." };

  // Honeypot: campo invisível que só robô preenche. Finge que deu certo.
  if (String(form.get("site") ?? "")) return { enviadoPara: email };

  if (await linkSenhaLiberado(email)) {
    const gerado = await gerarLinkSenha(email);
    if (gerado) await enviarLinkSenha(email, gerado.nome, gerado.link, "redefinir");
  }

  return { enviadoPara: email };
}
