"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin, SEM_PERMISSAO } from "@/lib/sessao";
import type { Resultado } from "../[id]/acoes";

const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

export async function criarCliente(
  _anterior: Resultado,
  form: FormData,
): Promise<Resultado> {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: SEM_PERMISSAO };
  const { supabase, user } = sessao;

  const nome = String(form.get("nome") ?? "").trim();
  if (nome.length < 2) return { erro: "O nome é obrigatório." };

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (email && !EMAIL.test(email)) return { erro: `E-mail inválido: ${email}` };

  const texto = (c: string) => String(form.get(c) ?? "").trim() || null;
  const documento = (texto("documento") ?? "").replace(/\D/g, "") || null;

  // Aviso, não bloqueio: a base herdada tem 33 cadastros sem documento, e o
  // Arthur às vezes cadastra alguém antes de ter o CNPJ em mãos.
  if (documento) {
    const { data: repetido } = await supabase
      .from("clientes")
      .select("id, nome")
      .eq("documento", documento)
      .maybeSingle();
    if (repetido) {
      return {
        erro: `Já existe um cliente com este documento: ${repetido.nome}. Abra o cadastro dele em vez de criar outro.`,
      };
    }
  }

  const { data: criado, error } = await supabase
    .from("clientes")
    .insert({
      nome,
      nome_fantasia: texto("nome_fantasia"),
      tipo_pessoa: form.get("tipo_pessoa") === "juridica" ? "juridica" : "fisica",
      status: String(form.get("status") ?? "ativo") as "ativo" | "inativo" | "incompleto",
      documento,
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
    })
    .select("id")
    .single();

  if (error || !criado) return { erro: error?.message ?? "Não foi possível salvar." };

  await supabase.from("log_atividades").insert({
    user_id: user.id,
    acao: "criou",
    entidade: "cliente",
    entidade_id: String(criado.id),
  });

  revalidatePath("/admin/clientes");
  // Vai direto para a ficha, onde está o botão de criar o login — que é o
  // próximo passo natural depois de cadastrar alguém.
  redirect(`/admin/clientes/${criado.id}`);
}
