import nodemailer from "nodemailer";
import { CONTATO } from "@/lib/contato";
import { reais } from "@/lib/formato";

/**
 * E-mail transacional do catálogo (confirmação de pedido).
 *
 * Transporte por SMTP simples, configurado por variável de ambiente:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_SENHA (os dois últimos opcionais —
 *   relay autorizado por IP não usa senha), EMAIL_REMETENTE.
 *
 * Em desenvolvimento, o Supabase local sobe um Mailpit que aceita SMTP sem
 * autenticação — os e-mails ficam visíveis em http://127.0.0.1:54324.
 *
 * SEM SMTP CONFIGURADO O PEDIDO NÃO PODE FALHAR: o envio é a confirmação, mas
 * o registro no banco é o pedido. Falha de e-mail é logada e engolida — o
 * painel continua mostrando o pedido e o Arthur liga do mesmo jeito.
 */

function transporte() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    ...(process.env.SMTP_USER
      ? {
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_SENHA ?? "",
          },
        }
      : {}),
  });
}

export type PedidoParaEmail = {
  numero: string;
  clienteNome: string;
  clienteEmail: string | null;
  observacoes: string | null;
  itens: {
    titulo: string;
    modelo: string;
    tamanho: string | null;
    pecasNoKit: number;
    qtdKits: number;
    precoKit: number;
  }[];
  totalAtacado: number;
  totalPecas: number;
};

function corpoTexto(pedido: PedidoParaEmail, paraLojista: boolean) {
  const linhas = pedido.itens
    .map(
      (i) =>
        `• ${i.titulo} (ref. ${i.modelo})${i.tamanho ? ` · tam. ${i.tamanho}` : ""} — ${i.qtdKits} ${i.qtdKits === 1 ? "embalagem" : "embalagens"} de ${i.pecasNoKit} ${i.pecasNoKit === 1 ? "peça" : "peças"} × ${reais(i.precoKit)} = ${reais(i.qtdKits * i.precoKit)}`,
    )
    .join("\n");

  const cabecalho = paraLojista
    ? `Olá, ${pedido.clienteNome}!\n\nRecebemos o seu pedido nº ${pedido.numero}. Nossa equipe entra em contato para combinar pagamento e envio — nada é cobrado pelo site.`
    : `Novo pedido nº ${pedido.numero} de ${pedido.clienteNome}.`;

  return `${cabecalho}

Itens:
${linhas}

Total de peças: ${pedido.totalPecas}
Total Atacado: ${reais(pedido.totalAtacado)}
${pedido.observacoes ? `\nObservações do cliente:\n${pedido.observacoes}\n` : ""}
—
${CONTATO.nome} · ${CONTATO.endereco.logradouro}, ${CONTATO.endereco.bairro} — ${CONTATO.endereco.cidade}/${CONTATO.endereco.uf}
${CONTATO.telefoneFixo} · WhatsApp ${CONTATO.whatsapp} · ${CONTATO.email}`;
}

/** Dispara a confirmação para o cliente e a cópia para a casa. */
export async function enviarEmailsDePedido(
  pedido: PedidoParaEmail,
  emailsDaCasa: string[],
) {
  const t = transporte();
  if (!t) {
    console.warn(
      `[email] SMTP não configurado — pedido ${pedido.numero} gravado sem e-mail de confirmação.`,
    );
    return { enviado: false };
  }

  const remetente =
    process.env.EMAIL_REMETENTE ?? `Comercial Galé <${CONTATO.email}>`;

  const envios: Promise<unknown>[] = [];
  if (pedido.clienteEmail) {
    envios.push(
      t.sendMail({
        from: remetente,
        to: pedido.clienteEmail,
        subject: `Pedido ${pedido.numero} recebido — Comercial Galé`,
        text: corpoTexto(pedido, true),
      }),
    );
  }
  for (const email of emailsDaCasa) {
    envios.push(
      t.sendMail({
        from: remetente,
        to: email,
        subject: `Novo pedido ${pedido.numero} — ${pedido.clienteNome}`,
        text: corpoTexto(pedido, false),
      }),
    );
  }

  const resultados = await Promise.allSettled(envios);
  const falhas = resultados.filter((r) => r.status === "rejected");
  for (const f of falhas) {
    console.error(`[email] falha no envio do pedido ${pedido.numero}:`, f);
  }
  return { enviado: falhas.length < resultados.length };
}
