"use server";

import { revalidatePath } from "next/cache";
import type { StatusPedido } from "@/lib/pedidos";
import { exigirAdmin, SEM_PERMISSAO } from "@/lib/sessao";

export async function mudarStatus(id: number, status: StatusPedido) {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: SEM_PERMISSAO };
  const { supabase, user } = sessao;
  const { error } = await supabase
    .from("pedidos")
    .update({ status })
    .eq("id", id);

  if (error) return { erro: error.message };

  // Registra quem mudou o quê — o painel antigo não tinha isso, e é a primeira
  // pergunta que aparece quando um pedido "muda sozinho".
  await supabase.from("log_atividades").insert({
    user_id: user.id,
    acao: "editou",
    entidade: "pedido",
    entidade_id: String(id),
    detalhes: { campo: "status", novo: status },
  });

  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  return { ok: true };
}

export async function salvarObservacao(id: number, texto: string) {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: SEM_PERMISSAO };
  const { supabase } = sessao;
  const { error } = await supabase
    .from("pedidos")
    .update({ observacoes_admin: texto.trim() || null })
    .eq("id", id);
  if (error) return { erro: error.message };
  revalidatePath(`/admin/pedidos/${id}`);
  return { ok: true };
}

export async function confirmarVinculo(id: number) {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: SEM_PERMISSAO };
  const { supabase } = sessao;
  const { error } = await supabase
    .from("pedidos")
    .update({ vinculo_revisar: false })
    .eq("id", id);
  if (error) return { erro: error.message };
  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath("/admin/pedidos");
  return { ok: true };
}
