"use server";

import { revalidatePath } from "next/cache";
import { criarClienteAdmin, criarClienteServidor } from "@/lib/supabase/server";

export type Resultado = { ok?: boolean; erro?: string; senha?: string };

const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

function revalidar(id: number) {
  revalidatePath(`/admin/clientes/${id}`);
  revalidatePath("/admin/clientes");
}

/** Confirma que quem está chamando é administrador de verdade. */
async function exigirAdmin() {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase
    .from("profiles")
    .select("role, ativo")
    .eq("id", user.id)
    .single();
  if (perfil?.role !== "admin" || !perfil.ativo) return null;
  return { supabase, user };
}

export async function salvarCliente(
  _anterior: Resultado,
  form: FormData,
): Promise<Resultado> {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: "Sessão expirada. Entre novamente." };

  const id = Number(form.get("id"));
  const nome = String(form.get("nome") ?? "").trim();
  if (nome.length < 2) return { erro: "O nome é obrigatório." };

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (email && !EMAIL.test(email)) return { erro: `E-mail inválido: ${email}` };

  const texto = (campo: string) =>
    String(form.get(campo) ?? "").trim() || null;

  const campos = {
    nome,
    nome_fantasia: texto("nome_fantasia"),
    tipo_pessoa: form.get("tipo_pessoa") === "juridica" ? "juridica" as const : "fisica" as const,
    status: String(form.get("status") ?? "ativo") as "ativo" | "inativo" | "incompleto",
    documento: (texto("documento") ?? "").replace(/\D/g, "") || null,
    inscricao_estadual: texto("inscricao_estadual"),
    rg: texto("rg"),
    email: email || null,
    telefone1: texto("telefone1"),
    telefone2: texto("telefone2"),
    nome_contato: texto("nome_contato"),
    cep: texto("cep"),
    logradouro: texto("logradouro"),
    numero: texto("numero"),
    complemento: texto("complemento"),
    bairro: texto("bairro"),
    cidade: texto("cidade"),
    uf: (texto("uf") ?? "").toUpperCase().slice(0, 2) || null,
    observacoes: texto("observacoes"),
    pode_ver_precos: form.get("pode_ver_precos") === "on",
  };

  const { error } = await sessao.supabase
    .from("clientes")
    .update(campos)
    .eq("id", id);

  if (error) return { erro: error.message };

  await sessao.supabase.from("log_atividades").insert({
    user_id: sessao.user.id,
    acao: "editou",
    entidade: "cliente",
    entidade_id: String(id),
  });

  revalidar(id);
  return { ok: true };
}

/**
 * Cria o login do cliente no catálogo.
 *
 * Precisa da chave mestra porque a API de administração de usuários do
 * Supabase não é acessível com a chave pública. Só roda no servidor, e só
 * depois de confirmar que quem pediu é administrador.
 */
export async function criarAcesso(
  clienteId: number,
  email: string,
): Promise<Resultado> {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: "Sessão expirada. Entre novamente." };

  const limpo = email.trim().toLowerCase();
  if (!EMAIL.test(limpo)) return { erro: "E-mail inválido." };

  const { data: cliente } = await sessao.supabase
    .from("clientes")
    .select("id, nome, user_id")
    .eq("id", clienteId)
    .single();

  if (!cliente) return { erro: "Cliente não encontrado." };
  if (cliente.user_id) return { erro: "Este cliente já tem login." };

  // Senha provisória forte. O cliente troca no primeiro acesso; o Arthur
  // repassa por telefone ou WhatsApp.
  const senha = Array.from(crypto.getRandomValues(new Uint8Array(9)))
    .map((n) => "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[n % 55])
    .join("");

  const admin = criarClienteAdmin();
  const { data: criado, error } = await admin.auth.admin.createUser({
    email: limpo,
    password: senha,
    email_confirm: true,
    user_metadata: { nome: cliente.nome, role: "cliente" },
  });

  if (error || !criado.user) {
    const jaExiste = error?.message?.toLowerCase().includes("already");
    return {
      erro: jaExiste
        ? "Já existe um login com este e-mail. Use outro endereço ou vincule o cadastro existente."
        : (error?.message ?? "Não foi possível criar o login."),
    };
  }

  const { error: erroVinculo } = await sessao.supabase
    .from("clientes")
    .update({ user_id: criado.user.id, email: limpo, status: "ativo" })
    .eq("id", clienteId);

  if (erroVinculo) {
    // Não deixa usuário órfão no Auth se o vínculo falhar.
    await admin.auth.admin.deleteUser(criado.user.id);
    return { erro: `Login criado mas não vinculado: ${erroVinculo.message}` };
  }

  await sessao.supabase.from("log_atividades").insert({
    user_id: sessao.user.id,
    acao: "criou",
    entidade: "acesso_cliente",
    entidade_id: String(clienteId),
    detalhes: { email: limpo },
  });

  revalidar(clienteId);
  return { ok: true, senha };
}

export async function revogarAcesso(clienteId: number): Promise<Resultado> {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: "Sessão expirada. Entre novamente." };

  const { data: cliente } = await sessao.supabase
    .from("clientes")
    .select("user_id")
    .eq("id", clienteId)
    .single();

  if (!cliente?.user_id) return { erro: "Este cliente não tem login." };

  const admin = criarClienteAdmin();
  const { error } = await admin.auth.admin.deleteUser(cliente.user_id);
  if (error) return { erro: error.message };

  // O cadastro e o histórico de pedidos permanecem; só o acesso sai.
  await sessao.supabase
    .from("clientes")
    .update({ user_id: null })
    .eq("id", clienteId);

  await sessao.supabase.from("log_atividades").insert({
    user_id: sessao.user.id,
    acao: "excluiu",
    entidade: "acesso_cliente",
    entidade_id: String(clienteId),
  });

  revalidar(clienteId);
  return { ok: true };
}

/** Envia o e-mail de redefinição de senha para o cliente. */
export async function reenviarSenha(email: string): Promise<Resultado> {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: "Sessão expirada. Entre novamente." };

  const { error } = await sessao.supabase.auth.resetPasswordForEmail(email);
  if (error) return { erro: error.message };
  return { ok: true };
}
