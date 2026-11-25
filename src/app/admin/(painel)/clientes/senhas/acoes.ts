"use server";

import { revalidatePath } from "next/cache";
import { registrarEnvios, smtpConfigurado } from "@/lib/email";
import { convidarComLink, linkSenhaLiberado } from "@/lib/links-senha";
import { exigirAdmin } from "@/lib/sessao";
import { filaDeConvite, pendentesDeSenha, TAMANHO_LOTE, TIPO_CONVITE } from "./dados";

/**
 * Lote de convites "crie a sua senha no site novo".
 *
 * Por que em lotes e não todos de uma vez:
 *   • o Brevo (plano grátis, conta compartilhada) aceita cerca de 300 e-mails
 *     por dia somando TUDO — pedidos, cadastros e senhas. Um disparo de
 *     centenas tomaria a cota e os e-mails de pedido do dia não sairiam;
 *   • cada envio leva ~1 s, e a função da Vercel tem tempo contado.
 * Quem já recebeu convite nos últimos 7 dias fica de fora do lote seguinte.
 */

export type ResultadoLote =
  | { erro: string }
  | { enviados: number; falharam: number; restantes: number };

export async function enviarLoteConvites(): Promise<ResultadoLote> {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: "Sessão expirada. Entre novamente." };
  if (!smtpConfigurado()) return { erro: "O envio de e-mails não está configurado neste ambiente." };

  const fila = filaDeConvite(await pendentesDeSenha());
  const lote = fila.slice(0, TAMANHO_LOTE);

  let enviados = 0;
  let falharam = 0;
  for (const p of lote) {
    // a mesma trava de 60 s do "Esqueci minha senha" (migração 009)
    if (!(await linkSenhaLiberado(p.email))) continue;
    const r = await convidarComLink(p.email, "site_novo");
    const ok = "emailEnviado" in r && r.emailEnviado;
    if (ok) enviados++;
    else falharam++;
    await registrarEnvios("clientes", p.id, [
      {
        tipo: TIPO_CONVITE,
        para: p.email,
        ok,
        erro: ok ? undefined : "erro" in r ? r.erro : "o servidor de e-mail recusou",
      },
    ]);
  }

  await sessao.supabase.from("log_atividades").insert({
    user_id: sessao.user.id,
    acao: "convites_senha",
    entidade: "clientes",
    detalhes: { enviados, falharam },
  });

  revalidatePath("/admin/clientes/senhas");
  return { enviados, falharam, restantes: Math.max(0, fila.length - lote.length) };
}
