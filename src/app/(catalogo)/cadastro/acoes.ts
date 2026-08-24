"use server";

import { criarClienteAdmin } from "@/lib/supabase/server";

/**
 * Solicitação de cadastro de lojista.
 *
 * Grava em `clientes` com status 'incompleto' — o mesmo status que o painel
 * lista para o Arthur revisar e liberar. Sem user_id: o login só nasce na
 * aprovação, criado pelo painel.
 *
 * Usa o cliente admin porque `clientes` não tem (de propósito) política de
 * INSERT para visitante — o formulário público é a única porta, e ela valida
 * no servidor.
 */

export type EstadoCadastro = {
  ok: boolean;
  erro?: string;
};

const UFS = new Set(
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "),
);

export async function solicitarCadastro(
  _anterior: EstadoCadastro,
  form: FormData,
): Promise<EstadoCadastro> {
  // Honeypot: humano não preenche campo invisível. Robô que preencher recebe
  // um "ok" silencioso e nada é gravado.
  if (String(form.get("website") ?? "").trim()) return { ok: true };

  const texto = (chave: string, max = 200) =>
    String(form.get(chave) ?? "")
      .trim()
      .slice(0, max);

  const tipoPessoa = texto("tipo_pessoa") === "fisica" ? "fisica" : "juridica";
  const nome = texto("nome");
  const documento = texto("documento").replace(/\D/g, "");
  const email = texto("email").toLowerCase();
  const telefone = texto("telefone", 30);

  if (nome.length < 3) return { ok: false, erro: "Informe o nome da loja ou razão social." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, erro: "Informe um e-mail válido — é por ele que confirmamos o pedido." };
  if (telefone.replace(/\D/g, "").length < 10)
    return { ok: false, erro: "Informe um telefone com DDD." };
  if (tipoPessoa === "juridica" && documento.length !== 14)
    return { ok: false, erro: "O CNPJ precisa ter 14 dígitos." };
  if (tipoPessoa === "fisica" && documento.length !== 11)
    return { ok: false, erro: "O CPF precisa ter 11 dígitos." };

  const uf = texto("uf", 2).toUpperCase();

  const supabase = criarClienteAdmin();

  // Mesmo documento já cadastrado? Não duplica — orienta a falar com a equipe.
  const { data: existente } = await supabase
    .from("clientes")
    .select("id, status")
    .eq("documento", documento)
    .limit(1)
    .maybeSingle();

  if (existente) {
    return {
      ok: false,
      erro:
        existente.status === "incompleto"
          ? "Já recebemos um cadastro com esse documento — ele está em análise. Se quiser agilizar, chame a equipe no WhatsApp."
          : "Esse documento já tem cadastro na Galé. Fale com a equipe pelo WhatsApp para recuperar o acesso.",
    };
  }

  const { error } = await supabase.from("clientes").insert({
    status: "incompleto",
    tipo_pessoa: tipoPessoa,
    nome,
    nome_fantasia: texto("nome_fantasia") || null,
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
    cidade: texto("cidade") || null,
    uf: UFS.has(uf) ? uf : null,
    observacoes: "Solicitação enviada pelo site.",
  });

  if (error) {
    console.error("[cadastro] falha ao gravar solicitação:", error);
    return {
      ok: false,
      erro: "Não conseguimos enviar agora. Tente de novo ou chame no WhatsApp.",
    };
  }

  return { ok: true };
}
