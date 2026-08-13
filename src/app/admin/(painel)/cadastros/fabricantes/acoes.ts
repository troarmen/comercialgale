"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";
import { paraSlug, slugLivre } from "@/lib/texto";

export type EstadoFabricante = { ok?: boolean; erro?: string };

const CAMINHO = "/admin/cadastros/fabricantes";

export async function salvarFabricante(
  _anterior: EstadoFabricante,
  form: FormData,
): Promise<EstadoFabricante> {
  const id = form.get("id") ? Number(form.get("id")) : null;
  const nome = String(form.get("nome") ?? "").trim();
  const descricao = String(form.get("descricao") ?? "").trim() || null;
  const ativo = form.get("ativo") === "on";

  if (nome.length < 2) return { erro: "O nome precisa ter ao menos 2 letras." };
  if (nome.length > 120) return { erro: "O nome passou de 120 caracteres." };

  const supabase = await criarClienteServidor();

  // O slug entra na URL do catálogo e é único. Se colidir, acrescenta um
  // número em vez de rejeitar o cadastro — o Arthur não deveria precisar
  // pensar em URL.
  const slug = await slugLivre(paraSlug(nome), async (candidato) => {
    const { data } = await supabase
      .from("fabricantes")
      .select("id")
      .eq("slug", candidato)
      .maybeSingle();
    return !!data && data.id !== id;
  });

  const campos = { nome, slug, descricao, ativo };

  const { error } = id
    ? await supabase.from("fabricantes").update(campos).eq("id", id)
    : await supabase.from("fabricantes").insert(campos);

  if (error) return { erro: error.message };

  revalidatePath(CAMINHO);
  revalidatePath("/admin/cadastros");
  return { ok: true };
}

export async function alternarAtivo(id: number, ativo: boolean) {
  const supabase = await criarClienteServidor();
  await supabase.from("fabricantes").update({ ativo }).eq("id", id);
  revalidatePath(CAMINHO);
}

/**
 * Só apaga fabricante que não tem produto. A chave estrangeira é RESTRICT, ou
 * seja, o banco recusaria de qualquer jeito — mas checar antes deixa a
 * mensagem compreensível em vez de um erro de constraint.
 */
export async function excluirFabricante(
  id: number,
): Promise<EstadoFabricante> {
  const supabase = await criarClienteServidor();

  const { count } = await supabase
    .from("produtos")
    .select("id", { count: "exact", head: true })
    .eq("fabricante_id", id);

  if (count) {
    return {
      erro: `Este fabricante tem ${count} ${count === 1 ? "produto" : "produtos"}. Desative em vez de excluir, ou mude os produtos de fabricante antes.`,
    };
  }

  const { error } = await supabase.from("fabricantes").delete().eq("id", id);
  if (error) return { erro: error.message };

  revalidatePath(CAMINHO);
  revalidatePath("/admin/cadastros");
  return { ok: true };
}
