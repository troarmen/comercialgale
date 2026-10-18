"use server";

import { revalidatePath } from "next/cache";
import type { StatusPedido } from "@/lib/pedidos";
import { exigirAdmin, exigirEquipe, SEM_PERMISSAO } from "@/lib/sessao";

/**
 * Única escrita que o colaborador faz. Vai pela função do banco
 * `mudar_status_pedido` (migração 008), que confere is_equipe(), muda SÓ o
 * status e registra quem mudou, de quê para quê — o painel antigo não tinha
 * isso, e é a primeira pergunta quando um pedido "muda sozinho".
 */
export async function mudarStatus(id: number, status: StatusPedido) {
  const sessao = await exigirEquipe();
  if (!sessao) return { erro: SEM_PERMISSAO };

  const { error } = await sessao.supabase.rpc("mudar_status_pedido", {
    p_id: id,
    p_status: status,
  });
  if (error) return { erro: error.message };

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
