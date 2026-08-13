"use server";

import { revalidatePath } from "next/cache";
import type { StatusPedido } from "@/lib/pedidos";
import { criarClienteServidor } from "@/lib/supabase/server";

export async function mudarStatus(id: number, status: StatusPedido) {
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("pedidos")
    .update({ status })
    .eq("id", id);

  if (error) return { erro: error.message };

  // Registra quem mudou o quê — o painel antigo não tinha isso, e é a primeira
  // pergunta que aparece quando um pedido "muda sozinho".
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("log_atividades").insert({
    user_id: user?.id ?? null,
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
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("pedidos")
    .update({ observacoes_admin: texto.trim() || null })
    .eq("id", id);
  if (error) return { erro: error.message };
  revalidatePath(`/admin/pedidos/${id}`);
  return { ok: true };
}

export async function confirmarVinculo(id: number) {
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("pedidos")
    .update({ vinculo_revisar: false })
    .eq("id", id);
  if (error) return { erro: error.message };
  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath("/admin/pedidos");
  return { ok: true };
}
