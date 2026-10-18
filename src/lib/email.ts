import nodemailer from "nodemailer";
import { CONTATO } from "@/lib/contato";
import { reais } from "@/lib/formato";
import { criarClienteAdmin } from "@/lib/supabase/server";

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

/**
 * Endereço que os LINKS dos e-mails usam (criar senha, ficha no painel).
 *
 * Separado do NEXT_PUBLIC_SITE_URL de propósito: aquele é o canônico do SEO e
 * já aponta para www.comercialgale.com.br — que, até a virada do domínio,
 * ainda é o SITE ANTIGO. Enquanto o site novo roda só na Vercel, defina
 * URL_LINKS_EMAIL=https://comercialgale.vercel.app; na virada, apague-a.
 */
export function urlDosLinks() {
  return (
    process.env.URL_LINKS_EMAIL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://www.comercialgale.com.br"
  ).replace(/\/+$/, "");
}

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

// ------------------------------------------------------------- link de senha

export type MotivoLinkSenha = "redefinir" | "acesso_liberado" | "convite_equipe";

const TEXTO_LINK: Record<MotivoLinkSenha, { assunto: string; abertura: string }> = {
  redefinir: {
    assunto: "Redefinir a sua senha — Comercial Galé",
    abertura:
      "Recebemos um pedido para redefinir a senha da sua conta. Se foi você, crie a nova senha pelo link abaixo.",
  },
  acesso_liberado: {
    assunto: "Seu acesso à Comercial Galé foi liberado",
    abertura:
      "Seu cadastro foi aprovado! Com o login você vê os preços de atacado e fecha pedidos pelo site. Para começar, crie a sua senha pelo link abaixo.",
  },
  convite_equipe: {
    assunto: "Seu acesso ao painel da Comercial Galé",
    abertura:
      "Você foi cadastrado na equipe da Comercial Galé e já pode consultar os pedidos no painel. Para começar, crie a sua senha pelo link abaixo.",
  },
};

/**
 * Link de uso único para a pessoa criar ou trocar a senha. O link vem de
 * `gerarLinkSenha` (src/lib/links-senha.ts) e vale 1 hora.
 *
 * Devolve false se não houver SMTP ou o envio falhar — quem chama decide o
 * que dizer na tela.
 */
export async function enviarLinkSenha(
  para: string,
  nome: string | null,
  link: string,
  motivo: MotivoLinkSenha,
) {
  const t = transporte();
  if (!t) {
    console.warn(`[email] SMTP não configurado — link de senha (${motivo}) não enviado.`);
    return false;
  }

  const { assunto, abertura } = TEXTO_LINK[motivo];
  const texto = `Olá${nome ? `, ${nome}` : ""}!

${abertura}

${link}

O link vale por 1 hora e funciona uma vez só. Se expirar, peça outro em ${urlDosLinks()}/esqueci-senha.
${motivo === "redefinir" ? "\nNão pediu? Pode ignorar este e-mail — a sua senha continua a mesma.\n" : ""}
—
${CONTATO.nome} · ${CONTATO.telefoneFixo} · WhatsApp ${CONTATO.whatsapp} · ${CONTATO.email}`;

  try {
    await t.sendMail({
      from: process.env.EMAIL_REMETENTE ?? `Comercial Galé <${CONTATO.email}>`,
      to: para,
      subject: assunto,
      text: texto,
    });
    return true;
  } catch (erro) {
    console.error(`[email] falha no link de senha (${motivo}):`, erro);
    return false;
  }
}

// ------------------------------------------------------------------ cadastro

/**
 * Quem recebe os avisos da casa (Configurações → e-mails de notificação).
 * A chave NÃO é pública — lida com a service_role, só no servidor.
 */
export async function emailsDaCasa() {
  const { data } = await criarClienteAdmin()
    .from("configuracoes")
    .select("valor")
    .eq("chave", "emails_notificacao")
    .maybeSingle();
  return Array.isArray(data?.valor)
    ? (data.valor as unknown[]).filter(
        (e): e is string => typeof e === "string" && e.includes("@"),
      )
    : [];
}

export type CadastroParaEmail = {
  id: number;
  nome: string;
  nomeFantasia: string | null;
  tipoPessoa: "fisica" | "juridica";
  documento: string;
  email: string;
  telefone: string;
  cidade: string | null;
  uf: string | null;
};

function documentoFormatado(c: CadastroParaEmail) {
  const d = c.documento;
  return c.tipoPessoa === "juridica" && d.length === 14
    ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
    : d.length === 11
      ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
      : d;
}

/**
 * Solicitação de cadastro: confirmação ao lojista + aviso à casa para aprovar.
 * Falha de e-mail NÃO desfaz o cadastro — ele já está no painel.
 */
export async function enviarEmailsDeCadastro(cadastro: CadastroParaEmail) {
  const t = transporte();
  if (!t) {
    console.warn(`[email] SMTP não configurado — cadastro ${cadastro.id} gravado sem e-mail.`);
    return;
  }
  const remetente = process.env.EMAIL_REMETENTE ?? `Comercial Galé <${CONTATO.email}>`;
  const site = urlDosLinks();
  const rodape = `—
${CONTATO.nome} · ${CONTATO.telefoneFixo} · WhatsApp ${CONTATO.whatsapp} · ${CONTATO.email}`;

  const paraLojista = `Olá, ${cadastro.nomeFantasia || cadastro.nome}!

Recebemos a sua solicitação de cadastro na ${CONTATO.nome}. Nossa equipe vai conferir os dados e, assim que o acesso for liberado, você recebe outro e-mail com o link para criar a sua senha. Com o login, os preços de atacado aparecem no site e você fecha pedidos por lá.

Enquanto isso, o catálogo completo está aberto em ${site}.

Quer agilizar? Chame a gente no WhatsApp ${CONTATO.whatsapp}.

${rodape}`;

  const paraCasa = `Novo cadastro pelo site, aguardando aprovação.

${cadastro.nome}${cadastro.nomeFantasia ? ` (${cadastro.nomeFantasia})` : ""}
${cadastro.tipoPessoa === "juridica" ? "CNPJ" : "CPF"}: ${documentoFormatado(cadastro)}
E-mail: ${cadastro.email}
Telefone: ${cadastro.telefone}
${cadastro.cidade ? `Cidade: ${cadastro.cidade}${cadastro.uf ? `/${cadastro.uf}` : ""}\n` : ""}
Para revisar e liberar o login:
${site}/admin/clientes/${cadastro.id}`;

  const envios = [
    t.sendMail({
      from: remetente,
      to: cadastro.email,
      subject: `Recebemos o seu cadastro — ${CONTATO.nome}`,
      text: paraLojista,
    }),
    ...(await emailsDaCasa()).map((para) =>
      t.sendMail({
        from: remetente,
        to: para,
        // Responder o aviso cai direto no lojista.
        replyTo: cadastro.email,
        subject: `Novo cadastro para aprovar — ${cadastro.nomeFantasia || cadastro.nome}`,
        text: paraCasa,
      }),
    ),
  ];
  const resultados = await Promise.allSettled(envios);
  for (const r of resultados) {
    if (r.status === "rejected") console.error(`[email] falha no cadastro ${cadastro.id}:`, r.reason);
  }
}
