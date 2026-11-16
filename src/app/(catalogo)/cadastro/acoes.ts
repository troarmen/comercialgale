"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { configPublica } from "@/lib/catalogo";
import { enviarEmailsDeCadastro } from "@/lib/email";
import { criarClienteAdmin, criarClienteServidor } from "@/lib/supabase/server";
import {
  documentoValido,
  EMAIL,
  hojeEmSaoPaulo,
  mascararEmail,
  normalizarDocumento,
} from "@/lib/validacao";
import { aprovacaoAutomatica, conferirCarimbo } from "./servidor";

/**
 * Cadastro de lojista com login na hora (pedido do cliente, nov/2026).
 *
 * Antes: o formulário gravava `clientes` como 'incompleto', sem login, e o
 * Arthur criava o acesso pelo painel ("Criar login e enviar convite"). Agora o
 * próprio lojista escolhe a senha aqui e, com "Liberar cadastro
 * automaticamente" ligado em Configurações (o padrão), já sai daqui logado e
 * vendo preço. Desligado, o login nasce igual, mas a ficha fica 'incompleto'
 * — sem preço — até a equipe ativar.
 *
 * Usa o cliente admin porque `clientes` não tem (de propósito) política de
 * INSERT para visitante, e porque o cadastro público do Supabase Auth está
 * DESLIGADO em produção: só a service_role cria usuário. O formulário é a
 * única porta, e ela valida tudo aqui no servidor.
 *
 * Tudo ou nada: se um passo falha depois de o usuário existir no Auth, o que
 * já foi criado é desfeito — nem usuário órfão no Auth, nem ficha sem login
 * fingindo que deu certo.
 */

export type EstadoCadastro = {
  ok: boolean;
  erro?: string;
  /** Caminho que resolve o erro, mostrado como botão ao lado da mensagem. */
  saida?: "entrar" | "whatsapp";
};

const UFS = new Set(
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "),
);

const FALHA_GENERICA =
  "Não conseguimos concluir o cadastro agora. Tente de novo em instantes ou chame a equipe no WhatsApp.";

/** E-mails de uma ficha antiga: o legado às vezes guardava dois num campo só. */
function emailsDaFicha(campo: string | null) {
  return (campo ?? "")
    .toLowerCase()
    .split(/[\s,;]+/)
    .filter((e) => e.includes("@"));
}

export async function cadastrarLojista(
  _anterior: EstadoCadastro,
  form: FormData,
): Promise<EstadoCadastro> {
  // Honeypot: humano não preenche campo invisível. Robô que preencher recebe
  // um "ok" silencioso e nada é gravado.
  if (String(form.get("website") ?? "").trim()) return { ok: true };

  // Tempo mínimo de preenchimento (ver servidor.ts). Mensagem neutra: quem
  // for gente e tiver sido rápido demais só precisa enviar de novo.
  const carimbo = conferirCarimbo(String(form.get("inicio") ?? ""));
  if (carimbo === "rapido") {
    return { ok: false, erro: "Não conseguimos enviar agora. Aguarde alguns segundos e envie de novo." };
  }
  if (carimbo === "invalido") {
    return { ok: false, erro: "Não conseguimos enviar agora. Recarregue a página e tente de novo." };
  }

  const texto = (chave: string, max = 200) =>
    String(form.get(chave) ?? "")
      .trim()
      .slice(0, max);

  const tipoPessoa = texto("tipo_pessoa") === "fisica" ? "fisica" : "juridica";
  const nome = texto("nome");
  const nomeFantasia = texto("nome_fantasia") || null;
  const documento = normalizarDocumento(tipoPessoa, texto("documento", 40));
  const email = texto("email").toLowerCase();
  const telefone = texto("telefone", 30);
  // Senha não passa por trim: espaço no começo ou no fim é escolha de quem criou.
  const senha = String(form.get("senha") ?? "");
  const confirmacao = String(form.get("confirmacao") ?? "");

  if (nome.length < 3) return { ok: false, erro: "Informe o nome da loja ou razão social." };
  if (tipoPessoa === "juridica" && documento.length !== 14)
    return { ok: false, erro: "O CNPJ precisa ter 14 caracteres." };
  if (tipoPessoa === "fisica" && documento.length !== 11)
    return { ok: false, erro: "O CPF precisa ter 11 dígitos." };
  if (!documentoValido(tipoPessoa, documento))
    return {
      ok: false,
      erro: `Esse ${tipoPessoa === "juridica" ? "CNPJ" : "CPF"} não é válido. Confira os números.`,
    };
  if (!EMAIL.test(email))
    return { ok: false, erro: "Informe um e-mail válido. É com ele que você entra e recebe a confirmação dos pedidos." };
  if (telefone.replace(/\D/g, "").length < 10)
    return { ok: false, erro: "Informe um telefone com DDD." };
  if (senha.length < 8) return { ok: false, erro: "A senha precisa ter pelo menos 8 caracteres." };
  // bcrypt (usado pelo Auth) ignora o que passa de 72 bytes.
  if (new TextEncoder().encode(senha).length > 72)
    return { ok: false, erro: "A senha passou do tamanho máximo. Use até 72 caracteres." };
  if (senha !== confirmacao) return { ok: false, erro: "As duas senhas não são iguais." };

  const sessao = await criarClienteServidor();
  const {
    data: { user: logado },
  } = await sessao.auth.getUser();
  if (logado) {
    // Entrar abaixo trocaria a sessão de quem já está logado (inclusive a do
    // Arthur, se ele abrir o cadastro com o painel aberto).
    return {
      ok: false,
      erro: "Há uma conta aberta neste navegador. Saia dela em Minha conta para cadastrar outra loja.",
    };
  }

  const admin = criarClienteAdmin();
  const uf = texto("uf", 2).toUpperCase();
  const cidade = texto("cidade") || null;

  // ------------------------------------------------ documento já cadastrado?
  //
  // Documento não é único no banco (o legado tem duplicados), então podem
  // vir várias fichas.
  const { data: existentes, error: erroBusca } = await admin
    .from("clientes")
    .select("id, status, user_id, email, pode_ver_precos")
    .eq("documento", documento)
    .order("id")
    .limit(20);
  if (erroBusca) {
    console.error("[cadastro] falha ao conferir documento:", erroBusca);
    return { ok: false, erro: FALHA_GENERICA };
  }

  let ficha: { id: number; status: "ativo" | "inativo" | "incompleto" } | null = null;
  if (existentes?.length) {
    const comLogin = existentes.find((c) => c.user_id);
    if (comLogin) {
      const mascara = mascararEmail(emailsDaFicha(comLogin.email)[0]);
      return {
        ok: false,
        erro: `Você já tem cadastro na Galé. Entre com o seu e-mail${mascara ? ` (${mascara})` : ""} ou use "Esqueci minha senha" para criar uma senha nova.`,
        saida: "entrar",
      };
    }
    // Ficha antiga SEM login: só entrega a quem digitou o MESMO e-mail da
    // ficha. Quem sabe só o CNPJ não pode herdar o cadastro de outra pessoa —
    // a /conta mostra endereço, telefone e documento.
    const mesmoEmail = existentes.find((c) => emailsDaFicha(c.email).includes(email));
    if (!mesmoEmail) {
      return {
        ok: false,
        erro: "Esse documento já tem cadastro na Galé, com outro e-mail. Para proteger os dados da loja, esse acesso é liberado pela equipe: fale com a gente pelo WhatsApp.",
        saida: "whatsapp",
      };
    }
    // Ficha desativada ou com preço suspenso foi decisão da equipe — o site
    // não desfaz isso sozinho.
    if (mesmoEmail.status === "inativo" || !mesmoEmail.pode_ver_precos) {
      return {
        ok: false,
        erro: "Encontramos o seu cadastro, mas ele precisa ser revisto pela equipe antes de liberar o acesso. Fale com a gente pelo WhatsApp.",
        saida: "whatsapp",
      };
    }
    ficha = { id: mesmoEmail.id, status: mesmoEmail.status };
  }

  // Ficha antiga já ativa continua ativa (foi aprovada um dia); o resto segue
  // o interruptor.
  const liberado = ficha?.status === "ativo" || (await aprovacaoAutomatica());
  const status = liberado ? ("ativo" as const) : ("incompleto" as const);

  // ----------------------------------------------------------- login no Auth
  const { data: criado, error: erroAuth } = await admin.auth.admin.createUser({
    email,
    password: senha,
    // O lojista acabou de digitar o e-mail e entra na sequência; o
    // e-mail de boas-vindas chega nesse mesmo endereço.
    email_confirm: true,
    user_metadata: { nome },
    // O papel vai no app_metadata: só a service_role escreve ali. O
    // user_metadata o próprio usuário altera (migração 005).
    app_metadata: { role: "cliente" },
  });

  if (erroAuth || !criado.user) {
    if (erroAuth?.code === "email_exists" || /already/i.test(erroAuth?.message ?? "")) {
      return {
        ok: false,
        erro: 'Esse e-mail já tem login na Galé. Entre com ele ou use "Esqueci minha senha" para criar uma senha nova.',
        saida: "entrar",
      };
    }
    if (erroAuth?.code === "weak_password") {
      return { ok: false, erro: "Senha fraca demais. Misture letras e números." };
    }
    console.error("[cadastro] falha ao criar login:", erroAuth);
    return { ok: false, erro: FALHA_GENERICA };
  }
  const userId = criado.user.id;

  // --------------------------------------------------------- ficha do cliente
  let clienteId: number;
  if (ficha) {
    const { data: vinculado, error } = await admin
      .from("clientes")
      .update({ user_id: userId, email, status })
      .eq("id", ficha.id)
      // Dois envios ao mesmo tempo: só o primeiro vincula.
      .is("user_id", null)
      .select("id");
    if (error || !vinculado?.length) {
      console.error("[cadastro] falha ao vincular a ficha existente:", error);
      await admin.auth.admin.deleteUser(userId);
      return { ok: false, erro: FALHA_GENERICA };
    }
    clienteId = ficha.id;
  } else {
    const { data: novo, error } = await admin
      .from("clientes")
      .insert({
        user_id: userId,
        status,
        pode_ver_precos: true,
        cadastrado_em: hojeEmSaoPaulo(),
        tipo_pessoa: tipoPessoa,
        nome,
        nome_fantasia: nomeFantasia,
        documento,
        inscricao_estadual: texto("inscricao_estadual", 30) || null,
        email,
        telefone1: telefone,
        nome_contato: texto("nome_contato") || null,
        cep: texto("cep", 12).replace(/\D/g, "") || null,
        logradouro: texto("logradouro") || null,
        numero: texto("numero", 20) || null,
        complemento: texto("complemento") || null,
        bairro: texto("bairro") || null,
        cidade,
        uf: UFS.has(uf) ? uf : null,
        observacoes: liberado
          ? "Cadastro feito pelo site, liberado automaticamente."
          : "Cadastro feito pelo site, aguardando liberação.",
      })
      .select("id")
      .single();
    if (error || !novo) {
      console.error("[cadastro] falha ao gravar a ficha:", error);
      await admin.auth.admin.deleteUser(userId);
      return { ok: false, erro: FALHA_GENERICA };
    }
    clienteId = novo.id;
  }

  // ------------------------------------------------------------------ entrar
  //
  // Com o cliente de servidor do @supabase/ssr: o setAll dele grava o cookie
  // de sessão na resposta desta action, e o redirect abaixo já chega logado.
  const { error: erroLogin } = await sessao.auth.signInWithPassword({ email, password: senha });
  if (erroLogin) {
    console.error("[cadastro] login criado mas a entrada falhou, desfazendo:", erroLogin);
    if (ficha) {
      await admin.from("clientes").update({ user_id: null, status: ficha.status }).eq("id", ficha.id);
    } else {
      await admin.from("clientes").delete().eq("id", clienteId);
    }
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, erro: FALHA_GENERICA };
  }

  await admin.from("log_atividades").insert({
    user_id: userId,
    acao: "criou",
    entidade: "cadastro_site",
    entidade_id: String(clienteId),
    detalhes: { liberado, ficha_existente: !!ficha },
  });

  // Boas-vindas ao lojista + aviso à casa. Vão DEPOIS da resposta (after): o
  // lojista não espera o SMTP, e falha de e-mail não desfaz nada — ele já
  // está logado e a ficha já está no painel.
  const config = await configPublica();
  after(() =>
    enviarEmailsDeCadastro(
      {
        id: clienteId,
        nome,
        nomeFantasia,
        tipoPessoa,
        documento,
        email,
        telefone,
        cidade,
        uf: UFS.has(uf) ? uf : null,
      },
      {
        liberado,
        fichaExistente: !!ficha,
        pedidoMinimo: config.pedidoMinimo,
        exibirVarejo: config.exibirVarejo,
      },
    ),
  );

  redirect("/cadastro/bem-vindo");
}
