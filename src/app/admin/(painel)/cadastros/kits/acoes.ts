"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";

export type EstadoKit = { ok?: boolean; erro?: string };

const CAMINHOS = ["/admin/cadastros", "/admin/cadastros/kits", "/admin/produtos"];
const revalidar = () => CAMINHOS.forEach((c) => revalidatePath(c));

export async function salvarKit(
  _anterior: EstadoKit,
  form: FormData,
): Promise<EstadoKit> {
  const id = form.get("id") ? Number(form.get("id")) : null;
  const pecas = Number(form.get("pecas") ?? 0);
  const ordem = Number(form.get("ordem") ?? 0) || 0;
  const ativo = form.get("ativo") === "on";

  if (!Number.isInteger(pecas) || pecas < 1) {
    return { erro: "A quantidade de peças precisa ser um número inteiro maior que zero." };
  }
  if (pecas > 999) return { erro: "Quantidade acima de 999 parece engano." };

  const supabase = await criarClienteServidor();

  const { data: repetido } = await supabase
    .from("kits")
    .select("id")
    .eq("pecas", pecas)
    .maybeSingle();
  if (repetido && repetido.id !== id) {
    return { erro: `Já existe um kit de ${pecas} peças.` };
  }

  const descricao = pecas === 1 ? "1 unidade" : `${pecas} unidades`;
  const campos = { pecas, descricao, ordem, ativo };

  const { error } = id
    ? await supabase.from("kits").update(campos).eq("id", id)
    : await supabase.from("kits").insert(campos);

  if (error) return { erro: error.message };
  revalidar();
  return { ok: true };
}

export async function alternarKit(id: number, ativo: boolean) {
  const supabase = await criarClienteServidor();
  await supabase.from("kits").update({ ativo }).eq("id", id);
  revalidar();
}

export async function excluirKit(id: number): Promise<EstadoKit> {
  const supabase = await criarClienteServidor();

  const { count } = await supabase
    .from("produtos")
    .select("id", { count: "exact", head: true })
    .eq("kit_id", id);

  if (count) {
    return {
      erro: `${count} ${count === 1 ? "produto usa" : "produtos usam"} este kit. Mude-os antes, ou apenas desative.`,
    };
  }

  const { error } = await supabase.from("kits").delete().eq("id", id);
  if (error) return { erro: error.message };
  revalidar();
  return { ok: true };
}
