"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { configPublica } from "@/lib/catalogo";
import { avisarCasaDoCadastro, enviarEmailsDeCadastro, type CadastroParaEmail } from "@/lib/email";
import { convidarComLink, linkSenhaLiberado } from "@/lib/links-senha";
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
 * Exceção: documento que JÁ TEM ficha (cliente antigo, pedido de cadastro
 * antigo). Aí ninguém entra na hora — ver vincularFichaAntiga — e ficha que a
 * equipe travou (Inativa, preço suspenso, acesso revogado) não se destrava
 * por aqui.
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
  /** Ficha antiga: e-mail (mascarado) para onde foi o link de criar a senha. */
  linkEnviadoPara?: string;
  /** Ficha antiga: se vai ver preço assim que criar a senha. */
  liberado?: boolean;
};

const UFS = new Set(
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "),
);

const FALHA_GENERICA =
  "Não conseguimos concluir o cadastro agora. Tente de novo em instantes ou chame a equipe no WhatsApp.";

const REVISAR_COM_A_EQUIPE: EstadoCadastro = {
  ok: false,
  erro: "Encontramos o seu cadastro, mas ele precisa ser revisto pela equipe antes de liberar o acesso. Fale com a gente pelo WhatsApp.",
  saida: "whatsapp",
};

/** E-mails de uma ficha antiga, em minúsculas: o legado às vezes guardava dois num campo só. */
function emailsDaFicha(campo: string | null) {
  return (campo ?? "")
    .toLowerCase()
    .split(/[\s,;]+/)
    .filter((e) => e.includes("@"));
}

type Admin = ReturnType<typeof criarClienteAdmin>;
type FichaAntiga = {
  id: number;
  status: "ativo" | "inativo" | "incompleto";
  nome: string;
  nome_fantasia: string | null;
};

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
  // Vencido (aba aberta há mais de 2 h) recebe a mesma resposta do forjado:
  // a página nova traz carimbo novo.
  if (carimbo === "invalido" || carimbo === "vencido") {
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
  const paraEmail = (id: number): CadastroParaEmail => ({
    id,
    nome,
    nomeFantasia,
    tipoPessoa,
    documento,
    email,
    telefone,
    cidade,
    uf: UFS.has(uf) ? uf : null,
  });

  // ------------------------------------------------ documento já cadastrado?
  //
  // Documento não é único no banco (o legado tem duplicados), então podem
  // vir várias fichas.
  const { data: existentes, error: erroBusca } = await admin
    .from("clientes")
    .select("id, status, user_id, email, pode_ver_precos, nome, nome_fantasia")
    .eq("documento", documento)
    .order("id")
    .limit(20);
  if (erroBusca) {
    console.error("[cadastro] falha ao conferir documento:", erroBusca);
    return { ok: false, erro: FALHA_GENERICA };
  }

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
    // Ficha antiga SEM login: só segue com o MESMO e-mail da ficha. Quem
    // sabe só o CNPJ não pode herdar o cadastro de outra pessoa — a /conta
    // mostra endereço, telefone e documento.
    const mesmoEmail = existentes.find((c) => emailsDaFicha(c.email).includes(email));
    if (!mesmoEmail) {
      return {
        ok: false,
        erro: "Esse documento já tem cadastro na Galé, com outro e-mail. Para proteger os dados da loja, esse acesso é liberado pela equipe: fale com a gente pelo WhatsApp.",
        saida: "whatsapp",
      };
    }
    // Ficha Inativa, com preço suspenso ou com acesso revogado pelo painel
    // foi decisão da equipe — o site não desfaz isso sozinho. O "Revogar
    // acesso" só apaga o login e deixa a ficha Ativa e sem login, igualzinha a
    // uma ficha antiga: o que a distingue é o registro no log. Ele vale para
    // QUALQUER ficha do documento (revogar é sobre a loja, não sobre a linha).
    if (mesmoEmail.status === "inativo" || !mesmoEmail.pode_ver_precos) return REVISAR_COM_A_EQUIPE;
    const { data: revogacoes, error: erroLog } = await admin
      .from("log_atividades")
      .select("id")
      .eq("entidade", "acesso_cliente")
      .eq("acao", "excluiu")
      .in(
        "entidade_id",
        existentes.map((c) => String(c.id)),
      )
      .limit(1);
    if (erroLog) {
      // Sem conseguir conferir, não entrega a ficha.
      console.error("[cadastro] falha ao conferir revogação:", erroLog);
      return { ok: false, erro: FALHA_GENERICA };
    }
    if (revogacoes?.length) return REVISAR_COM_A_EQUIPE;

    return vincularFichaAntiga(admin, mesmoEmail, email, paraEmail(mesmoEmail.id));
  }

  // ------------------------------------------------------------ cadastro novo
  const aprovacao = await aprovacaoAutomatica();
  const liberado = aprovacao.ligada;
  const status = liberado ? ("ativo" as const) : ("incompleto" as const);

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
  if (erroAuth || !criado.user) return erroDoAuth(erroAuth);
  const userId = criado.user.id;

  const { data: novo, error: erroFicha } = await admin
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
  if (erroFicha || !novo) {
    console.error("[cadastro] falha ao gravar a ficha:", erroFicha);
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, erro: FALHA_GENERICA };
  }

  // ------------------------------------------------------------------ entrar
  //
  // Com o cliente de servidor do @supabase/ssr: o setAll dele grava o cookie
  // de sessão na resposta desta action, e o redirect abaixo já chega logado.
  const { error: erroLogin } = await sessao.auth.signInWithPassword({ email, password: senha });
  if (erroLogin) {
    console.error("[cadastro] login criado mas a entrada falhou, desfazendo:", erroLogin);
    await admin.from("clientes").delete().eq("id", novo.id);
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, erro: FALHA_GENERICA };
  }

  await admin.from("log_atividades").insert({
    user_id: userId,
    acao: "criou",
    entidade: "cadastro_site",
    entidade_id: String(novo.id),
    detalhes: {
      liberado,
      ficha_existente: false,
      // Configuração ilegível: entrou como incompleto (ver servidor.ts).
      ...(aprovacao.falhou ? { erro_config_liberacao: true } : {}),
    },
  });

  // Boas-vindas ao lojista + aviso à casa. Vão DEPOIS da resposta (after): o
  // lojista não espera o SMTP, e falha de e-mail não desfaz nada — ele já
  // está logado e a ficha já está no painel.
  const config = await configPublica();
  after(() =>
    enviarEmailsDeCadastro(paraEmail(novo.id), {
      liberado,
      fichaExistente: false,
      pedidoMinimo: config.pedidoMinimo,
      exibirVarejo: config.exibirVarejo,
    }),
  );

  redirect("/cadastro/bem-vindo");
}

function erroDoAuth(erro: { code?: string; message?: string } | null): EstadoCadastro {
  if (erro?.code === "email_exists" || /already/i.test(erro?.message ?? "")) {
    return {
      ok: false,
      erro: 'Esse e-mail já tem login na Galé. Entre com ele ou use "Esqueci minha senha" para criar uma senha nova.',
      saida: "entrar",
    };
  }
  if (erro?.code === "weak_password") {
    return { ok: false, erro: "Senha fraca demais. Misture letras e números." };
  }
  console.error("[cadastro] falha ao criar login:", erro);
  return { ok: false, erro: FALHA_GENERICA };
}

/**
 * Ficha antiga sem login, com o e-mail digitado igual a um dos da ficha.
 *
 * NÃO entra na hora: o CNPJ é público na Receita e o e-mail da loja costuma
 * estar no site ou no Instagram dela — os dois juntos não provam nada. O
 * login nasce SEM senha (a digitada é descartada), já vinculado à ficha, e o
 * link de criar senha vai para esse e-mail: só quem abre a caixa de entrada
 * entra. Continua automático, sem ação da equipe; /definir-senha já deixa a
 * pessoa logada.
 *
 * Os dados digitados NÃO sobrescrevem a ficha — nem o campo E-mail, que numa
 * ficha antiga pode ter dois endereços ("a@x; b@y") e a grafia original. O
 * login usa o endereço que bateu; a ficha só ganha o `user_id` (e, com a
 * liberação automática, passa de 'incompleto' a 'ativo').
 */
async function vincularFichaAntiga(
  admin: Admin,
  ficha: FichaAntiga,
  email: string,
  cadastro: CadastroParaEmail,
): Promise<EstadoCadastro> {
  // Trava de 60 s do link de senha (migração 009). Com a ficha ainda sem
  // login quase sempre libera; segura dois envios seguidos do formulário.
  if (!(await linkSenhaLiberado(email))) {
    return { ok: false, erro: "Acabamos de enviar um link para esse e-mail. Aguarde um minuto e confira a caixa de entrada." };
  }

  // Ficha já ativa continua ativa (foi aprovada um dia); o resto segue o
  // interruptor.
  const aprovacao = ficha.status === "ativo" ? null : await aprovacaoAutomatica();
  const liberado = ficha.status === "ativo" || !!aprovacao?.ligada;
  const status = liberado ? ("ativo" as const) : ficha.status;

  const { data: criado, error: erroAuth } = await admin.auth.admin.createUser({
    email,
    // Sem senha: a pessoa cria a dela pelo link. O e-mail sai marcado como
    // confirmado porque o link (de uso único, para este endereço) é a prova.
    email_confirm: true,
    user_metadata: { nome: ficha.nome_fantasia || ficha.nome },
    app_metadata: { role: "cliente" },
  });
  if (erroAuth || !criado.user) return erroDoAuth(erroAuth);
  const userId = criado.user.id;

  /** Volta a ficha ao que era e apaga o login: nada de usuário órfão no Auth. */
  const desfazer = async (motivo: string, erro?: unknown) => {
    console.error(`[cadastro] ${motivo}, desfazendo o vínculo da ficha ${ficha.id}:`, erro ?? "");
    const { error: erroVolta } = await admin
      .from("clientes")
      .update({ user_id: null, status: ficha.status })
      .eq("id", ficha.id)
      .eq("user_id", userId);
    if (erroVolta) console.error("[cadastro] falha ao devolver a ficha:", erroVolta);
    const { error: erroApaga } = await admin.auth.admin.deleteUser(userId);
    if (erroApaga) console.error(`[cadastro] falha ao apagar o login ${userId}:`, erroApaga);
  };

  const { data: vinculado, error: erroVinculo } = await admin
    .from("clientes")
    .update({ user_id: userId, status })
    .eq("id", ficha.id)
    // Dois envios ao mesmo tempo: só o primeiro vincula.
    .is("user_id", null)
    .select("id");
  if (erroVinculo || !vinculado?.length) {
    await desfazer("falha ao vincular a ficha existente", erroVinculo);
    return { ok: false, erro: FALHA_GENERICA };
  }

  // Aqui o e-mail é a ÚNICA porta de entrada. Se o link não sai, desfaz tudo
  // para a pessoa poder tentar de novo — e o link NUNCA vai para a tela
  // (convidarComLink o devolve para o painel mostrar ao Arthur; aqui, mostrar
  // seria entregar a ficha a quem não provou ser dono do e-mail).
  const convite = await convidarComLink(email, liberado ? "acesso_liberado" : "acesso_criado");
  if (!("emailEnviado" in convite) || !convite.emailEnviado) {
    await desfazer("o link de criar senha não saiu", "erro" in convite ? convite.erro : "SMTP");
    return {
      ok: false,
      erro: "Não conseguimos enviar o e-mail com o link agora. Tente de novo em instantes ou chame a equipe no WhatsApp.",
      saida: "whatsapp",
    };
  }

  await admin.from("log_atividades").insert({
    user_id: userId,
    acao: "criou",
    entidade: "cadastro_site",
    entidade_id: String(ficha.id),
    detalhes: {
      liberado,
      ficha_existente: true,
      aguarda_senha_pelo_link: true,
      ...(aprovacao?.falhou ? { erro_config_liberacao: true } : {}),
    },
  });

  const config = await configPublica();
  after(() =>
    avisarCasaDoCadastro(cadastro, {
      liberado,
      fichaExistente: {
        passouParaAtivo: ficha.status !== "ativo" && status === "ativo",
        nomeDaFicha: ficha.nome_fantasia || ficha.nome,
      },
      pedidoMinimo: config.pedidoMinimo,
      exibirVarejo: config.exibirVarejo,
    }),
  );

  return { ok: true, linkEnviadoPara: mascararEmail(email) ?? email, liberado };
}
