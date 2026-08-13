"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";
import { paraSlug, slugLivre } from "@/lib/texto";

export type EstadoCategoria = { ok?: boolean; erro?: string };

const CAMINHOS = ["/admin/cadastros", "/admin/cadastros/categorias", "/admin/produtos"];
// forEach passa (valor, índice) — o índice cairia no 2º parâmetro de
// revalidatePath, que espera "layout" ou "page". Por isso a seta explícita.
const revalidar = () => CAMINHOS.forEach((c) => revalidatePath(c));

export async function salvarCategoria(
  _anterior: EstadoCategoria,
  form: FormData,
): Promise<EstadoCategoria> {
  const id = form.get("id") ? Number(form.get("id")) : null;
  const nome = String(form.get("nome") ?? "").trim();
  const descricao = String(form.get("descricao") ?? "").trim() || null;
  const ordem = Number(form.get("ordem") ?? 0) || 0;
  const ativo = form.get("ativo") === "on";

  if (nome.length < 2) return { erro: "O nome precisa ter ao menos 2 letras." };
  if (nome.length > 80) return { erro: "O nome passou de 80 caracteres." };

  const supabase = await criarClienteServidor();

  const slug = await slugLivre(paraSlug(nome), async (candidato) => {
    const { data } = await supabase
      .from("categorias")
      .select("id")
      .eq("slug", candidato)
      .maybeSingle();
    return !!data && data.id !== id;
  });

  const campos = { nome, slug, descricao, ordem, ativo };
  const { error } = id
    ? await supabase.from("categorias").update(campos).eq("id", id)
    : await supabase.from("categorias").insert(campos);

  if (error) return { erro: error.message };
  revalidar();
  return { ok: true };
}

export async function alternarCategoria(id: number, ativo: boolean) {
  const supabase = await criarClienteServidor();
  await supabase.from("categorias").update({ ativo }).eq("id", id);
  revalidar();
}

/**
 * Categoria só sai se não tiver produto NEM subcategoria pendurada. As duas
 * chaves estrangeiras são RESTRICT — o banco recusaria de qualquer forma, mas
 * checar aqui deixa a mensagem entendível.
 */
export async function excluirCategoria(
  id: number,
): Promise<EstadoCategoria> {
  const supabase = await criarClienteServidor();

  const [{ count: produtos }, { count: subs }] = await Promise.all([
    supabase.from("produtos").select("id", { count: "exact", head: true }).eq("categoria_id", id),
    supabase.from("subcategorias").select("id", { count: "exact", head: true }).eq("categoria_id", id),
  ]);

  if (produtos) {
    return {
      erro: `Esta categoria tem ${produtos} ${produtos === 1 ? "produto" : "produtos"}. Mova-os para outra categoria antes, ou apenas desative.`,
    };
  }
  if (subs) {
    return {
      erro: `Esta categoria tem ${subs} ${subs === 1 ? "subcategoria" : "subcategorias"}. Exclua ou mova antes.`,
    };
  }

  const { error } = await supabase.from("categorias").delete().eq("id", id);
  if (error) return { erro: error.message };
  revalidar();
  return { ok: true };
}
