"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";
import { TIPOS } from "@/lib/tamanhos";

export type EstadoTamanho = { ok?: boolean; erro?: string };

const CAMINHOS = ["/admin/cadastros", "/admin/cadastros/tamanhos", "/admin/produtos"];
const revalidar = () => CAMINHOS.forEach((c) => revalidatePath(c));

export async function salvarTamanho(
  _anterior: EstadoTamanho,
  form: FormData,
): Promise<EstadoTamanho> {
  const id = form.get("id") ? Number(form.get("id")) : null;
  const valor = String(form.get("valor") ?? "").trim();
  const tipo = String(form.get("tipo") ?? "tamanho");
  const ordem = Number(form.get("ordem") ?? 0) || 0;
  const ativo = form.get("ativo") === "on";

  if (!valor) return { erro: "O valor é obrigatório." };
  if (valor.length > 40) return { erro: "O valor passou de 40 caracteres." };
  if (!TIPOS.some((t) => t.valor === tipo)) return { erro: "Tipo inválido." };

  const supabase = await criarClienteServidor();

  const { data: repetido } = await supabase
    .from("tamanhos")
    .select("id")
    .eq("valor", valor)
    .maybeSingle();
  if (repetido && repetido.id !== id) {
    return { erro: `"${valor}" já existe na lista.` };
  }

  const campos = { valor, tipo, ordem, ativo };
  const { error } = id
    ? await supabase.from("tamanhos").update(campos).eq("id", id)
    : await supabase.from("tamanhos").insert(campos);

  if (error) return { erro: error.message };
  revalidar();
  return { ok: true };
}

export async function alternarTamanho(id: number, ativo: boolean) {
  const supabase = await criarClienteServidor();
  await supabase.from("tamanhos").update({ ativo }).eq("id", id);
  revalidar();
}

/** Reclassifica em lote — serve para arrumar a bagunça herdada de uma vez. */
export async function reclassificar(
  ids: number[],
  tipo: string,
): Promise<EstadoTamanho> {
  if (!ids.length) return { erro: "Nenhum tamanho selecionado." };
  if (!TIPOS.some((t) => t.valor === tipo)) return { erro: "Tipo inválido." };

  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("tamanhos")
    .update({ tipo })
    .in("id", ids);

  if (error) return { erro: error.message };
  revalidar();
  return { ok: true };
}

export async function excluirTamanho(id: number): Promise<EstadoTamanho> {
  const supabase = await criarClienteServidor();

  const { count } = await supabase
    .from("produto_tamanhos")
    .select("id", { count: "exact", head: true })
    .eq("tamanho_id", id);

  if (count) {
    return {
      erro: `Este tamanho é usado por ${count} ${count === 1 ? "produto" : "produtos"}. Desative em vez de excluir.`,
    };
  }

  const { error } = await supabase.from("tamanhos").delete().eq("id", id);
  if (error) return { erro: error.message };
  revalidar();
  return { ok: true };
}
