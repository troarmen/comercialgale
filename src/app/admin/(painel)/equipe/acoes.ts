"use server";

import { revalidatePath } from "next/cache";
import { senhaProvisoria } from "@/lib/senha";
import { exigirAdmin, SEM_PERMISSAO } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/server";

export type ResultadoEquipe = { ok?: boolean; erro?: string; senha?: string };

const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

/**
 * Esta tela só gerencia COLABORADORES. Admin aparece na lista mas não é
 * desativado nem removido por aqui — perder o último admin trancaria o
 * painel, e promover alguém a admin continua sendo decisão feita no banco.
 */
async function colaborador(
  supabase: NonNullable<Awaited<ReturnType<typeof exigirAdmin>>>["supabase"],
  id: string,
) {
  const { data } = await supabase
    .from("profiles")
    .select("id, nome, role")
    .eq("id", id)
    .maybeSingle();
  return data?.role === "colaborador" ? data : null;
}

export async function criarColaborador(
  nome: string,
  email: string,
): Promise<ResultadoEquipe> {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: SEM_PERMISSAO };

  const nomeLimpo = nome.trim();
  const limpo = email.trim().toLowerCase();
  if (nomeLimpo.length < 2) return { erro: "Informe o nome." };
  if (!EMAIL.test(limpo)) return { erro: "E-mail inválido." };

  const senha = senhaProvisoria();

  const admin = criarClienteAdmin();
  const { data: criado, error } = await admin.auth.admin.createUser({
    email: limpo,
    password: senha,
    email_confirm: true,
    user_metadata: { nome: nomeLimpo },
    app_metadata: { role: "colaborador" },
  });

  if (error || !criado.user) {
    const jaExiste = error?.message?.toLowerCase().includes("already");
    return {
      erro: jaExiste
        ? "Já existe um login com este e-mail (pode ser de um cliente do catálogo). Use outro endereço."
        : (error?.message ?? "Não foi possível criar o login."),
    };
  }

  // O GoTrue INSERE o usuário e só depois grava o app_metadata (num UPDATE):
  // quando o gatilho handle_new_user roda, o papel ainda não está lá e o
  // profile nasce 'cliente' — o que é o certo para qualquer signup. Quem
  // promove é o painel, aqui, com a service_role. O app_metadata acima fica
  // como registro coerente do papel.
  const { data: promovido } = await admin
    .from("profiles")
    .update({ role: "colaborador" })
    .eq("id", criado.user.id)
    .select("id")
    .maybeSingle();

  if (!promovido) {
    // Não deixa login órfão com papel errado.
    await admin.auth.admin.deleteUser(criado.user.id);
    return { erro: "Não foi possível definir o papel do colaborador. Tente de novo." };
  }

  await sessao.supabase.from("log_atividades").insert({
    user_id: sessao.user.id,
    acao: "criou",
    entidade: "colaborador",
    entidade_id: criado.user.id,
    detalhes: { email: limpo, nome: nomeLimpo },
  });

  revalidatePath("/admin/equipe");
  return { ok: true, senha };
}

/** Desativar corta o acesso na hora (is_equipe() checa `ativo`), sem apagar. */
export async function alternarColaborador(
  id: string,
  ativo: boolean,
): Promise<ResultadoEquipe> {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: SEM_PERMISSAO };
  if (!(await colaborador(sessao.supabase, id))) {
    return { erro: "Colaborador não encontrado." };
  }

  const { error } = await sessao.supabase
    .from("profiles")
    .update({ ativo })
    .eq("id", id);
  if (error) return { erro: error.message };

  await sessao.supabase.from("log_atividades").insert({
    user_id: sessao.user.id,
    acao: "editou",
    entidade: "colaborador",
    entidade_id: id,
    detalhes: { campo: "ativo", novo: ativo },
  });

  revalidatePath("/admin/equipe");
  return { ok: true };
}

/** Remove o login de vez. O profile sai em cascata; o histórico fica. */
export async function removerColaborador(id: string): Promise<ResultadoEquipe> {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: SEM_PERMISSAO };
  const alvo = await colaborador(sessao.supabase, id);
  if (!alvo) return { erro: "Colaborador não encontrado." };

  const { error } = await criarClienteAdmin().auth.admin.deleteUser(id);
  if (error) return { erro: error.message };

  await sessao.supabase.from("log_atividades").insert({
    user_id: sessao.user.id,
    acao: "excluiu",
    entidade: "colaborador",
    entidade_id: id,
    detalhes: { nome: alvo.nome },
  });

  revalidatePath("/admin/equipe");
  return { ok: true };
}
