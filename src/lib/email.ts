import nodemailer from "nodemailer";
import { CONTATO } from "@/lib/contato";
import { reais } from "@/lib/formato";
import { criarClienteAdmin } from "@/lib/supabase/server";
import { formatarDocumento } from "@/lib/validacao";

/**
 * E-mail transacional do catálogo (pedido, cadastro, links de senha).
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

function remetente() {
  return process.env.EMAIL_REMETENTE ?? `Comercial Galé <${CONTATO.email}>`;
}

// ------------------------------------------------------------ HTML de e-mail
//
// Regras de HTML de e-mail, que não são as da web: o Outlook do Windows
// desenha com o motor do Word (sem flex, sem grid, sem max-width, sem CSS
// externo) e o Gmail descarta <style> em vários cenários. Por isso: layout em
// <table>, TODO estilo inline, largura travada em 640px por um comentário
// condicional só do Outlook, cores repetidas em `bgcolor`. E todo texto que
// vem do banco ou do formulário passa por esc() — nome de loja com "<" ou
// observação com HTML colado não pode virar marcação no e-mail da casa.
//
// Exceção de propósito nas TABELAS DE ITENS, que crescem com o pedido: as
// células não levam `style`. A fonte vai uma vez só na <table> (Gmail e Apple
// Mail herdam; o Outlook, que não herda, recebe a mesma regra por um <style>
// que só ele lê, no <head>), o espaçamento vem do `cellpadding` e as linhas
// se separam por faixas alternadas em `bgcolor` no <tr> — atributo que todo
// cliente respeita, ao contrário de borda, que teria de ir em cada célula.
// Repetir o estilo inteiro em cada <td> custava ~1,2 KB por linha, e o Gmail
// corta a mensagem acima de 102 KB: pedido com ~40 linhas (produto ×
// tamanho) chegava com a tabela de Varejo escondida atrás de "Ver mensagem
// inteira". Assim, a linha fica em ~0,3 KB.

const COR = {
  marca: "#d12437",
  texto: "#1f2328",
  suave: "#5b6470",
  tenue: "#8a929c",
  borda: "#e3e7ec",
  fundo: "#f6f7f9",
  cabecalho: "#f1f3f5",
  destaque: "#fef2f3",
};
const FONTE = "Arial, Helvetica, sans-serif";

function esc(valor: unknown) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Texto do usuário com as quebras de linha preservadas (observações). */
function escMultilinha(valor: string) {
  return esc(valor).replace(/\r?\n/g, "<br>");
}

/** 1234.5 → "1.234,50" — a tabela já diz "(R$)" no cabeçalho, como a antiga. */
const DECIMAL = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
function valor(n: number) {
  return DECIMAL.format(n);
}

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

function dataHoraSaoPaulo(quando: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(quando);
}

function moldura({
  titulo,
  previa,
  conteudo,
}: {
  titulo: string;
  /** Linha que o Gmail/Outlook mostram ao lado do assunto, na caixa de entrada. */
  previa: string;
  conteudo: string;
}) {
  const e = CONTATO.endereco;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(titulo)}</title>
<!--[if mso]><style>table,td,th,h1,h2,p,span,a{font-family:${FONTE};}.itens td{font-size:13px;line-height:1.4;color:${COR.texto};}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${COR.fundo};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COR.fundo};">${esc(previa)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.fundo}" style="background-color:${COR.fundo};">
<tr><td align="center" style="padding:20px 8px;">
<!--[if mso]><table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;">
<tr><td style="padding:0 4px 14px;font-family:${FONTE};">
<span style="font-size:20px;font-weight:bold;color:${COR.marca};">${esc(CONTATO.nome)}</span>
<span style="font-size:12px;color:${COR.tenue};">&nbsp;·&nbsp;atacado de moda íntima desde ${esc(CONTATO.fundacao)}</span>
</td></tr>
<tr><td bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid ${COR.borda};border-radius:12px;padding:26px 18px;font-family:${FONTE};font-size:14px;line-height:1.55;color:${COR.texto};">
${conteudo}
</td></tr>
<tr><td style="padding:16px 4px 0;font-family:${FONTE};font-size:12px;line-height:1.6;color:${COR.tenue};">
${esc(CONTATO.razao)}<br>
${esc(`${e.logradouro}, ${e.bairro} — ${e.cidade}/${e.uf}`)}<br>
WhatsApp ${esc(CONTATO.whatsapp)} · <a href="mailto:${esc(CONTATO.email)}" style="color:${COR.suave};">${esc(CONTATO.email)}</a> · ${esc(CONTATO.horario)}
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

function h1(texto: string) {
  return `<h1 style="margin:0 0 12px;font-family:${FONTE};font-size:20px;line-height:1.3;color:${COR.texto};">${esc(texto)}</h1>`;
}

function h2(texto: string, apoio?: string) {
  return `<h2 style="margin:26px 0 8px;font-family:${FONTE};font-size:15px;line-height:1.3;color:${COR.texto};">${esc(texto)}${
    apoio ? ` <span style="font-weight:normal;font-size:12px;color:${COR.suave};">— ${esc(apoio)}</span>` : ""
  }</h2>`;
}

/** `html` já precisa vir escapado (permite <strong> montado aqui). */
function paragrafo(html: string) {
  return `<p style="margin:0 0 12px;font-family:${FONTE};font-size:14px;line-height:1.55;color:${COR.texto};">${html}</p>`;
}

/** Botão "à prova de Outlook": célula de tabela pintada, não <a> com padding. */
function botao(href: string, rotulo: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 16px;"><tr>
<td bgcolor="${COR.marca}" style="background-color:${COR.marca};border-radius:999px;">
<a href="${esc(href)}" style="display:inline-block;padding:11px 22px;font-family:${FONTE};font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">${esc(rotulo)}</a>
</td></tr></table>`;
}

function link(href: string, rotulo = href) {
  return `<a href="${esc(href)}" style="color:${COR.marca};">${esc(rotulo)}</a>`;
}

/** Bloco rótulo → valor (dados do cliente). Linha sem valor não aparece. */
function tabelaDados(linhas: [string, string | null | undefined][]) {
  const visiveis = linhas.filter(([, v]) => v && String(v).trim());
  if (!visiveis.length) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:${FONTE};font-size:13px;">
${visiveis
  .map(
    ([rotulo, v]) => `<tr>
<td width="130" valign="top" style="padding:5px 10px 5px 0;color:${COR.suave};border-bottom:1px solid ${COR.borda};">${esc(rotulo)}</td>
<td valign="top" style="padding:5px 0;color:${COR.texto};font-weight:bold;border-bottom:1px solid ${COR.borda};word-break:break-word;">${esc(v)}</td>
</tr>`,
  )
  .join("\n")}
</table>`;
}

/** Caixa de destaque (observações, aviso). `html` já escapado. */
function caixa(html: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 8px;"><tr>
<td bgcolor="${COR.destaque}" style="background-color:${COR.destaque};border-left:3px solid ${COR.marca};padding:10px 12px;font-family:${FONTE};font-size:13px;line-height:1.55;color:${COR.texto};">${html}</td>
</tr></table>`;
}

/** Passo a passo numerado em tabela — <ol> perde o recuo no Outlook. */
function passos(itens: { titulo: string; texto: string }[]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:${FONTE};">
${itens
  .map(
    (p, i) => `<tr>
<td width="30" valign="top" style="padding:6px 0;"><span style="display:inline-block;width:22px;height:22px;line-height:22px;border-radius:11px;background-color:${COR.destaque};color:${COR.marca};font-size:12px;font-weight:bold;text-align:center;">${i + 1}</span></td>
<td valign="top" style="padding:6px 0;font-size:14px;line-height:1.55;color:${COR.texto};"><strong>${esc(p.titulo)}</strong><br><span style="color:${COR.suave};">${p.texto}</span></td>
</tr>`,
  )
  .join("\n")}
</table>`;
}

/** Os mesmos passos em texto puro (alternativa do e-mail). */
function passosTexto(itens: { titulo: string; texto: string }[]) {
  const semHtml = (html: string) =>
    html
      // link vira "rótulo (endereço)", ou só o endereço quando são iguais
      .replace(/<a href="([^"]+)"[^>]*>([^<]*)<\/a>/g, (_, href: string, rotulo: string) =>
        rotulo === href ? href : `${rotulo} (${href})`,
      )
      .replace(/<[^>]+>/g, "")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  return itens.map((p, i) => `${i + 1}. ${p.titulo}\n   ${semHtml(p.texto)}`).join("\n\n");
}

const RODAPE_TEXTO = `—
${CONTATO.nome} · ${CONTATO.endereco.logradouro}, ${CONTATO.endereco.bairro} — ${CONTATO.endereco.cidade}/${CONTATO.endereco.uf}
WhatsApp ${CONTATO.whatsapp} · ${CONTATO.email} · ${CONTATO.horario}`;

// -------------------------------------------------------------------- pedido

export type ItemPedidoEmail = {
  titulo: string;
  modelo: string;
  /** Fabricante do produto. pedido_itens não guarda — vem do produto no fechamento. */
  marca: string | null;
  tamanho: string | null;
  pecasNoKit: number;
  qtdKits: number;
  precoKitAtacado: number;
  precoKitVarejo: number;
};

export type PedidoParaEmail = {
  id: number;
  numero: string;
  criadoEm: Date;
  cliente: {
    nome: string;
    nomeFantasia: string | null;
    documento: string | null;
    email: string | null;
    telefone: string | null;
    cidade: string | null;
    uf: string | null;
  };
  observacoes: string | null;
  itens: ItemPedidoEmail[];
  /** Totais do pedido como o gatilho do banco gravou (recalcular_pedido). */
  totalAtacado: number;
  totalVarejo: number;
  totalPecas: number;
  totalEmbalagens: number;
};

type Tabela = "atacado" | "varejo";

const TABELA: Record<Tabela, { titulo: string; apoio: string; rodape: string }> = {
  atacado: {
    titulo: "Valores de Atacado",
    apoio: "o preço de lojista",
    rodape: "Valor Pedido Atacado",
  },
  varejo: {
    titulo: "Valores de Varejo",
    apoio: "preço de revenda ao consumidor",
    rodape: "Valor Pedido Varejo",
  },
};

function precoDoItem(i: ItemPedidoEmail, tabela: Tabela) {
  return tabela === "atacado" ? i.precoKitAtacado : i.precoKitVarejo;
}

function rotuloDocumento(documento: string | null) {
  return (documento ?? "").length === 14 ? "CNPJ" : "CPF";
}

/**
 * Tabela no formato do e-mail do sistema antigo, pedido do cliente (nov/2026):
 * Produto · Ref · Marca · Tamanho · Qtd · Valor (R$), com o total no rodapé.
 * Qtd é em EMBALAGENS; quantas peças vêm em cada uma fica embaixo do nome,
 * junto do preço da embalagem — "Valor" é a linha inteira (qtd × embalagem).
 */
function tabelaItensHtml(pedido: PedidoParaEmail, tabela: Tabela) {
  const cfg = TABELA[tabela];
  // Cabeçalho em caixa normal e 11px: no celular a tabela tem ~330px para seis
  // colunas, e cada letra a mais no cabeçalho sai da coluna do produto.
  const th = (texto: string, alinhar: "left" | "right" | "center" = "left", largura = "") =>
    `<th align="${alinhar}"${largura ? ` width="${largura}"` : ""} style="padding:8px 5px;font-family:${FONTE};font-size:11px;font-weight:bold;color:${COR.suave};border-bottom:1px solid ${COR.borda};">${texto}</th>`;
  // Célula de item SEM style (ver o topo do arquivo): só atributo, e só
  // quando muda alguma coisa.
  const td = (html: string, attrs = "") => `<td${attrs}>${html}</td>`;

  const linhas = pedido.itens
    .map((i, n) => {
      const preco = precoDoItem(i, tabela);
      // Faixa alternada no lugar da linha divisória.
      return `<tr valign="top"${n % 2 ? ` bgcolor="${COR.fundo}"` : ""}>${td(
        `${esc(i.titulo)}<br><span style="font-size:11px;color:${COR.suave}">Emb. com ${esc(plural(i.pecasNoKit, "peça", "peças"))} · ${esc(reais(preco))} cada</span>`,
      )}${td(esc(i.modelo))}${td(esc(i.marca ?? "—"))}${td(esc(i.tamanho ?? "—"), ' align="center"')}${td(
        String(i.qtdKits),
        ' align="center"',
      )}${td(valor(i.qtdKits * preco), ' align="right" nowrap')}</tr>`;
    })
    .join("\n");

  const total = tabela === "atacado" ? pedido.totalAtacado : pedido.totalVarejo;

  return `${h2(cfg.titulo, cfg.apoio)}
<table class="itens" width="100%" cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid ${COR.borda};font-family:${FONTE};font-size:13px;line-height:1.4;color:${COR.texto};">
<tr bgcolor="${COR.cabecalho}" style="background-color:${COR.cabecalho};">
${th("Produto", "left", "38%")}${th("Ref")}${th("Marca")}${th("Tamanho", "center")}${th("Qtd<br>(emb.)", "center")}${th("Valor<br>(R$)", "right")}
</tr>
${linhas}
<tr bgcolor="${COR.cabecalho}" style="background-color:${COR.cabecalho};">
<td colspan="6" align="right" style="padding:10px 6px;font-family:${FONTE};font-size:14px;font-weight:bold;color:${COR.texto};">${esc(cfg.rodape)}: ${esc(reais(total))}</td>
</tr>
</table>`;
}

function tabelaItensTexto(pedido: PedidoParaEmail, tabela: Tabela) {
  const cfg = TABELA[tabela];
  const total = tabela === "atacado" ? pedido.totalAtacado : pedido.totalVarejo;
  const linhas = pedido.itens.map((i) => {
    const preco = precoDoItem(i, tabela);
    return `• ${i.titulo} · Ref ${i.modelo} · ${i.marca ?? "—"} · Tam. ${i.tamanho ?? "—"}
  ${plural(i.qtdKits, "embalagem", "embalagens")} com ${plural(i.pecasNoKit, "peça", "peças")} × ${reais(preco)} = ${reais(i.qtdKits * preco)}`;
  });
  return `${cfg.titulo.toUpperCase()} (${cfg.apoio})
${linhas.join("\n")}
${cfg.rodape}: ${reais(total)}`;
}

function dadosDoCliente(pedido: PedidoParaEmail): [string, string | null][] {
  const c = pedido.cliente;
  return [
    ["Razão social / nome", c.nome],
    ["Nome da loja", c.nomeFantasia],
    [rotuloDocumento(c.documento), c.documento ? formatarDocumento(c.documento) : null],
    ["Telefone", c.telefone],
    ["E-mail", c.email],
    ["Cidade", c.cidade ? `${c.cidade}${c.uf ? `/${c.uf}` : ""}` : null],
  ];
}

function totalGeral(pedido: PedidoParaEmail) {
  return `${plural(pedido.totalEmbalagens, "embalagem", "embalagens")} · ${plural(pedido.totalPecas, "peça", "peças")}`;
}

function htmlPedido(pedido: PedidoParaEmail, paraLojista: boolean, comVarejo: boolean) {
  const nome = pedido.cliente.nomeFantasia || pedido.cliente.nome;
  const quando = dataHoraSaoPaulo(pedido.criadoEm);
  const abertura = paraLojista
    ? `${h1(`Recebemos o seu pedido nº ${pedido.numero}`)}
${paragrafo(`Olá, ${esc(nome)}! Seu pedido chegou em ${esc(quando)}. A nossa equipe entra em contato para combinar <strong>pagamento e envio</strong> — nada é cobrado pelo site.`)}
${paragrafo("Confira abaixo os itens e os seus dados. Algo errado? Responda este e-mail ou chame no WhatsApp.")}`
    : `${h1(`Novo pedido nº ${pedido.numero}`)}
${paragrafo(`De <strong>${esc(nome)}</strong>, fechado pelo site em ${esc(quando)}. Responder este e-mail fala direto com o cliente.`)}
${botao(`${urlDosLinks()}/admin/pedidos/${pedido.id}`, "Abrir o pedido no painel")}`;

  const observacoes = pedido.observacoes
    ? `${h2("Observações do cliente")}${caixa(escMultilinha(pedido.observacoes))}`
    : "";

  return moldura({
    titulo: `Pedido ${pedido.numero}`,
    previa: `${totalGeral(pedido)} · Atacado ${reais(pedido.totalAtacado)}`,
    conteudo: `${abertura}
${h2(paraLojista ? "Seus dados" : "Cliente")}
${tabelaDados(dadosDoCliente(pedido))}
${observacoes}
${tabelaItensHtml(pedido, "atacado")}
${comVarejo ? tabelaItensHtml(pedido, "varejo") : ""}
${paragrafo(`<span style="display:block;margin-top:14px;font-size:13px;color:${COR.suave};">Total do pedido: <strong style="color:${COR.texto};">${esc(totalGeral(pedido))}</strong>.</span>`)}`,
  });
}

function textoPedido(pedido: PedidoParaEmail, paraLojista: boolean, comVarejo: boolean) {
  const nome = pedido.cliente.nomeFantasia || pedido.cliente.nome;
  const quando = dataHoraSaoPaulo(pedido.criadoEm);
  const abertura = paraLojista
    ? `Olá, ${nome}!\n\nRecebemos o seu pedido nº ${pedido.numero} (${quando}). Nossa equipe entra em contato para combinar pagamento e envio — nada é cobrado pelo site.`
    : `Novo pedido nº ${pedido.numero} de ${nome}, fechado pelo site em ${quando}.\nNo painel: ${urlDosLinks()}/admin/pedidos/${pedido.id}`;

  const dados = dadosDoCliente(pedido)
    .filter(([, v]) => v)
    .map(([r, v]) => `${r}: ${v}`)
    .join("\n");

  return `${abertura}

${paraLojista ? "SEUS DADOS" : "CLIENTE"}
${dados}
${pedido.observacoes ? `\nOBSERVAÇÕES DO CLIENTE\n${pedido.observacoes}\n` : ""}
${tabelaItensTexto(pedido, "atacado")}
${comVarejo ? `\n${tabelaItensTexto(pedido, "varejo")}\n` : ""}
Total do pedido: ${totalGeral(pedido)}

${RODAPE_TEXTO}`;
}

/**
 * Dispara a confirmação para o cliente e a cópia para a casa.
 *
 * A casa recebe SEMPRE as duas tabelas (Atacado e Varejo). O lojista só vê a
 * de Varejo se `exibir_preco_varejo` estiver ligado — é a mesma regra do
 * catálogo: com o interruptor desligado, o Varejo some do site e do e-mail.
 */
export async function enviarEmailsDePedido(
  pedido: PedidoParaEmail,
  emailsDaCasa: string[],
  { varejoParaLojista }: { varejoParaLojista: boolean },
) {
  const t = transporte();
  if (!t) {
    console.warn(
      `[email] SMTP não configurado — pedido ${pedido.numero} gravado sem e-mail de confirmação.`,
    );
    return { enviado: false };
  }

  const envios: Promise<unknown>[] = [];
  if (pedido.cliente.email) {
    envios.push(
      t.sendMail({
        from: remetente(),
        to: pedido.cliente.email,
        subject: `Pedido ${pedido.numero} recebido — Comercial Galé`,
        text: textoPedido(pedido, true, varejoParaLojista),
        html: htmlPedido(pedido, true, varejoParaLojista),
      }),
    );
  }
  for (const email of emailsDaCasa) {
    envios.push(
      t.sendMail({
        from: remetente(),
        to: email,
        // Responder a cópia cai direto no lojista.
        ...(pedido.cliente.email ? { replyTo: pedido.cliente.email } : {}),
        subject: `Novo pedido ${pedido.numero} — ${pedido.cliente.nomeFantasia || pedido.cliente.nome}`,
        text: textoPedido(pedido, false, true),
        html: htmlPedido(pedido, false, true),
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

/**
 * `acesso_criado`: ficha antiga que pediu o login pelo site com a liberação
 * automática DESLIGADA — o login existe, mas o preço espera a equipe. Não dá
 * para mandar o "acesso_liberado" ("seu cadastro foi aprovado") nesse caso.
 */
export type MotivoLinkSenha = "redefinir" | "acesso_liberado" | "acesso_criado" | "convite_equipe";

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
  acesso_criado: {
    assunto: "Seu login na Comercial Galé foi criado",
    abertura:
      "Encontramos o cadastro da sua loja e criamos o seu login. Os preços de atacado aparecem assim que a nossa equipe liberar a loja — avisamos por e-mail. Para começar, crie a sua senha pelo link abaixo.",
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
${CONTATO.nome} · WhatsApp ${CONTATO.whatsapp} · ${CONTATO.email}`;

  try {
    await t.sendMail({
      from: remetente(),
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

/** O que mudou numa ficha antiga que ganhou login pelo site. */
export type MudancasNaFicha = {
  /** estava 'incompleto' e a liberação automática a passou para 'ativo' */
  passouParaAtivo: boolean;
  /** nome como está na FICHA — o digitado no site pode ser outro */
  nomeDaFicha: string;
};

export type ContextoCadastro = {
  /** true = vê preço (aprovação automática); false = aguarda a equipe. */
  liberado: boolean;
  /**
   * false = cliente novo. Objeto = a ficha já existia (cliente antigo ou
   * pedido de cadastro antigo) e só ganhou o login agora — com o que mudou.
   */
  fichaExistente: false | MudancasNaFicha;
  pedidoMinimo: number;
  exibirVarejo: boolean;
};

/** Como o site funciona, para o e-mail de boas-vindas. Texto já escapado. */
function comoFunciona(ctx: ContextoCadastro) {
  const site = urlDosLinks();
  const precos = ctx.exibirVarejo
    ? "cada produto mostra o preço de <strong>Atacado</strong> (o seu preço de lojista) e o de <strong>Varejo</strong> (preço de revenda ao consumidor)."
    : "cada produto mostra o preço de <strong>Atacado</strong>, o seu preço de lojista.";
  return [
    ctx.liberado
      ? { titulo: "Os preços já estão liberados", texto: `Com o login, ${precos}` }
      : {
          titulo: "Os preços aparecem quando a equipe liberar",
          texto: `O seu login já funciona. Assim que a nossa equipe conferir os dados, os preços passam a aparecer no site — avisamos por e-mail.`,
        },
    {
      titulo: "Venda por embalagem fechada",
      texto:
        "Cada produto vem em embalagem com um número fixo de peças. A página do produto mostra quantas peças vêm na embalagem, o preço da embalagem e o preço por peça — você escolhe quantas embalagens quer de cada tamanho.",
    },
    ...(ctx.pedidoMinimo > 0
      ? [
          {
            titulo: `Atacado a partir de ${reais(ctx.pedidoMinimo)}`,
            texto:
              "É o valor de referência das compras no atacado. O site avisa quando o pedido está abaixo, mas aceita mesmo assim — a equipe combina com você.",
          },
        ]
      : []),
    {
      titulo: "Como fechar o pedido",
      texto:
        "Na página do produto, escolha as embalagens por tamanho e clique em <strong>Adicionar ao pedido</strong>. Quando terminar, abra <strong>Pedido</strong> no topo do site, confira os itens e clique em <strong>Fechar pedido</strong>. A confirmação chega por e-mail.",
    },
    {
      titulo: "Pagamento e envio, direto com a gente",
      texto:
        "Depois do pedido, a nossa equipe entra em contato para combinar pagamento e envio. <strong>Nada é cobrado pelo site.</strong>",
    },
    {
      titulo: "Para entrar de novo",
      texto: `Entre em ${link(`${site}/entrar`)} com o seu e-mail e a senha que você criou. Esqueceu a senha? Peça um link novo em ${link(`${site}/esqueci-senha`)}.`,
    },
  ];
}

function faleComAGenteHtml() {
  return `${h2("Fale com a gente")}
${paragrafo(`WhatsApp <strong>${esc(CONTATO.whatsapp)}</strong> · ${link(`mailto:${CONTATO.email}`, CONTATO.email)}<br><span style="color:${COR.suave};">${esc(CONTATO.horario)} · ${esc(`${CONTATO.endereco.logradouro}, ${CONTATO.endereco.bairro} — ${CONTATO.endereco.cidade}/${CONTATO.endereco.uf}`)}</span>`)}`;
}

const FALE_COM_A_GENTE_TEXTO = `FALE COM A GENTE
WhatsApp ${CONTATO.whatsapp} · ${CONTATO.email}
${CONTATO.horario}`;

function boasVindas(cadastro: CadastroParaEmail, ctx: ContextoCadastro) {
  const site = urlDosLinks();
  const nome = cadastro.nomeFantasia || cadastro.nome;
  const titulo = ctx.liberado
    ? "Cadastro liberado: os preços já estão no site"
    : "Recebemos o seu cadastro";
  const abertura = ctx.liberado
    ? `Olá, ${esc(nome)}! Sua loja está cadastrada na ${esc(CONTATO.nome)} e o seu login já funciona: é só entrar com <strong>${esc(cadastro.email)}</strong> e a senha que você criou.`
    : `Olá, ${esc(nome)}! Seu login já está criado (<strong>${esc(cadastro.email)}</strong> e a senha que você escolheu). Os preços aparecem assim que a nossa equipe conferir os dados e liberar a sua loja.`;
  const itens = comoFunciona(ctx);

  const html = moldura({
    titulo,
    previa: ctx.liberado
      ? "Seu login funciona e os preços de atacado já aparecem no catálogo."
      : "Seu login já funciona; os preços aparecem quando a equipe liberar a sua loja.",
    conteudo: `${h1(titulo)}
${paragrafo(abertura)}
${botao(`${site}/produtos`, ctx.liberado ? "Ver o catálogo com preços" : "Ver o catálogo")}
${h2("Como funciona")}
${passos(itens)}
${faleComAGenteHtml()}`,
  });

  const texto = `Olá, ${nome}!

${
  ctx.liberado
    ? `Sua loja está cadastrada na ${CONTATO.nome} e o seu login já funciona: entre com ${cadastro.email} e a senha que você criou.`
    : `Seu login já está criado (${cadastro.email} e a senha que você escolheu). Os preços aparecem assim que a nossa equipe conferir os dados e liberar a sua loja.`
}

Catálogo: ${site}/produtos

COMO FUNCIONA

${passosTexto(itens)}

${FALE_COM_A_GENTE_TEXTO}

${RODAPE_TEXTO}`;

  return {
    assunto: ctx.liberado
      ? `Boas-vindas à ${CONTATO.nome}: seus preços estão liberados`
      : `Recebemos o seu cadastro — ${CONTATO.nome}`,
    html,
    texto,
  };
}

function avisoParaCasa(cadastro: CadastroParaEmail, ctx: ContextoCadastro) {
  const antiga = ctx.fichaExistente;
  const nome = antiga ? antiga.nomeDaFicha : cadastro.nomeFantasia || cadastro.nome;
  const ficha = `${urlDosLinks()}/admin/clientes/${cadastro.id}`;

  const origem = antiga
    ? `Alguém pediu pelo site o login de uma ficha que já existia, com um dos e-mails dela (${cadastro.email}).`
    : "Cliente novo, cadastrado pelo site.";
  const situacao = antiga
    ? `Por segurança, a pessoa só entra depois de abrir o link que mandamos para ${cadastro.email} e criar a senha. ${
        ctx.liberado
          ? "Quando entrar, já vê os preços."
          : "Mesmo depois disso, os preços só aparecem quando você mudar a situação para Ativo na ficha (a liberação automática está desligada em Configurações)."
      }`
    : ctx.liberado
      ? 'Cadastrado e liberado automaticamente: já entrou e vê os preços. Para suspender, mude a situação ou o "pode ver preços" na ficha.'
      : "O login já existe, mas os preços só aparecem quando você mudar a situação para Ativo na ficha (a liberação automática está desligada em Configurações).";
  // O que de fato mudou na ficha antiga — o resto do que foi digitado NÃO
  // foi gravado (a ficha da equipe vale mais que o formulário).
  const mudou = antiga
    ? [
        "ganhou o login",
        antiga.passouParaAtivo ? "passou de Incompleto para Ativo" : null,
      ]
        .filter(Boolean)
        .join("; ")
    : "";
  const titulo = antiga
    ? `Ficha antiga pediu o login pelo site${ctx.liberado ? "" : " (aguardando liberação)"}: ${nome}`
    : ctx.liberado
      ? `Novo cliente cadastrado e liberado: ${nome}`
      : `Novo cadastro aguardando liberação: ${nome}`;

  const dados: [string, string | null][] = [
    ["Razão social / nome", cadastro.nome],
    ["Nome da loja", cadastro.nomeFantasia],
    [cadastro.tipoPessoa === "juridica" ? "CNPJ" : "CPF", formatarDocumento(cadastro.documento)],
    ["E-mail", cadastro.email],
    ["Telefone", cadastro.telefone],
    ["Cidade", cadastro.cidade ? `${cadastro.cidade}${cadastro.uf ? `/${cadastro.uf}` : ""}` : null],
  ];

  const html = moldura({
    titulo,
    previa: `${origem} ${antiga ? "Entra depois de confirmar o e-mail." : ctx.liberado ? "Já vê os preços." : "Aguarda liberação."}`,
    conteudo: `${h1(titulo)}
${paragrafo(esc(origem))}
${caixa(esc(situacao))}
${antiga ? paragrafo(`<strong>Na ficha:</strong> ${esc(mudou)}.`) : ""}
${botao(ficha, "Abrir a ficha no painel")}
${h2(antiga ? "Dados digitados no site" : "Dados do cadastro", antiga ? "não foram gravados na ficha" : undefined)}
${tabelaDados(dados)}
${paragrafo(`<span style="display:block;margin-top:14px;font-size:13px;color:${COR.suave};">Responder este e-mail fala direto com o cliente.</span>`)}`,
  });

  const texto = `${titulo}

${origem}
${situacao}
${antiga ? `\nNa ficha: ${mudou}.\n\nDados digitados no site (não foram gravados na ficha):` : ""}
${dados
  .filter(([, v]) => v)
  .map(([r, v]) => `${r}: ${v}`)
  .join("\n")}

Ficha no painel:
${ficha}`;

  return {
    assunto: antiga
      ? `Ficha antiga pediu login pelo site${ctx.liberado ? "" : ", para liberar"} — ${nome}`
      : ctx.liberado
        ? `Novo cliente cadastrado e liberado — ${nome}`
        : `Novo cadastro para liberar — ${nome}`,
    html,
    texto,
  };
}

/**
 * Aviso de cadastro para a casa (Configurações → e-mails de notificação).
 * Responder cai direto no lojista. Falha é logada e engolida.
 */
export async function avisarCasaDoCadastro(cadastro: CadastroParaEmail, ctx: ContextoCadastro) {
  const t = transporte();
  if (!t) {
    console.warn(`[email] SMTP não configurado — aviso do cadastro ${cadastro.id} não enviado.`);
    return;
  }
  const casa = avisoParaCasa(cadastro, ctx);
  const resultados = await Promise.allSettled(
    (await emailsDaCasa()).map((para) =>
      t.sendMail({
        from: remetente(),
        to: para,
        replyTo: cadastro.email,
        subject: casa.assunto,
        text: casa.texto,
        html: casa.html,
      }),
    ),
  );
  for (const r of resultados) {
    if (r.status === "rejected") console.error(`[email] falha no aviso do cadastro ${cadastro.id}:`, r.reason);
  }
}

/**
 * Cadastro NOVO pelo site: boas-vindas ao lojista + aviso à casa.
 * Falha de e-mail NÃO desfaz o cadastro — ele já está no painel e o lojista
 * já entrou.
 */
export async function enviarEmailsDeCadastro(
  cadastro: CadastroParaEmail,
  ctx: ContextoCadastro,
) {
  const t = transporte();
  if (!t) {
    console.warn(`[email] SMTP não configurado — cadastro ${cadastro.id} gravado sem e-mail.`);
    return;
  }

  const lojista = boasVindas(cadastro, ctx);
  const [boas] = await Promise.allSettled([
    t.sendMail({
      from: remetente(),
      to: cadastro.email,
      subject: lojista.assunto,
      text: lojista.texto,
      html: lojista.html,
    }),
    avisarCasaDoCadastro(cadastro, ctx),
  ]);
  if (boas.status === "rejected") console.error(`[email] falha nas boas-vindas do cadastro ${cadastro.id}:`, boas.reason);
}

/**
 * Aviso ao lojista de que a equipe liberou a loja dele — para quem se
 * cadastrou com a liberação automática DESLIGADA e já tem login e senha
 * (por isso não leva link de senha, ao contrário do "acesso_liberado").
 */
export async function enviarAvisoDeLiberacao(para: string, nome: string) {
  const t = transporte();
  if (!t) return false;
  const site = urlDosLinks();
  const titulo = "Sua loja foi liberada: os preços já aparecem";
  try {
    await t.sendMail({
      from: remetente(),
      to: para,
      subject: `${titulo} — ${CONTATO.nome}`,
      text: `Olá, ${nome}!

A nossa equipe liberou o seu cadastro. Entre em ${site}/entrar com o seu e-mail e a senha que você criou: os preços de atacado já aparecem e você fecha pedidos pelo site.

Esqueceu a senha? ${site}/esqueci-senha

${RODAPE_TEXTO}`,
      html: moldura({
        titulo,
        previa: "Entre com o seu e-mail e senha: os preços de atacado já aparecem.",
        conteudo: `${h1(titulo)}
${paragrafo(`Olá, ${esc(nome)}! A nossa equipe liberou o seu cadastro. Entre com o seu e-mail e a senha que você criou: os preços de atacado já aparecem e você fecha pedidos pelo site.`)}
${botao(`${site}/entrar?destino=/produtos`, "Entrar e ver os preços")}
${paragrafo(`<span style="font-size:13px;color:${COR.suave};">Esqueceu a senha? ${link(`${site}/esqueci-senha`, "Peça um link novo")}.</span>`)}`,
      }),
    });
    return true;
  } catch (erro) {
    console.error("[email] falha no aviso de liberação:", erro);
    return false;
  }
}
