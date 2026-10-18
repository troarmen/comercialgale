"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin, SEM_PERMISSAO } from "@/lib/sessao";
import { paraSlug, slugLivre } from "@/lib/texto";

export type EstadoSubcategoria = { ok?: boolean; erro?: string };

const CAMINHOS = [
  "/admin/cadastros",
  "/admin/cadastros/subcategorias",
  "/admin/cadastros/categorias",
  "/admin/produtos",
];
// forEach passa (valor, índice) — o índice cairia no 2º parâmetro de
// revalidatePath, que espera "layout" ou "page". Por isso a seta explícita.
const revalidar = () => CAMINHOS.forEach((c) => revalidatePath(c));

export async function salvarSubcategoria(
  _anterior: EstadoSubcategoria,
  form: FormData,
): Promise<EstadoSubcategoria> {
  const id = form.get("id") ? Number(form.get("id")) : null;
  const categoriaId = Number(form.get("categoria_id") ?? 0);
  const nome = String(form.get("nome") ?? "").trim();
  const descricao = String(form.get("descricao") ?? "").trim() || null;
  const ordem = Number(form.get("ordem") ?? 0) || 0;
  const ativo = form.get("ativo") === "on";

  if (!categoriaId) return { erro: "Escolha a categoria." };
  if (nome.length < 2) return { erro: "O nome precisa ter ao menos 2 letras." };
  if (nome.length > 80) return { erro: "O nome passou de 80 caracteres." };

  const sessao = await exigirAdmin();
  if (!sessao) return { erro: SEM_PERMISSAO };
  const { supabase } = sessao;

  // O slug é único DENTRO da categoria, não no catálogo todo: "Adulto" pode
  // existir em Pijamas e em Cuecas ao mesmo tempo.
  const slug = await slugLivre(paraSlug(nome), async (candidato) => {
    const { data } = await supabase
      .from("subcategorias")
      .select("id")
      .eq("categoria_id", categoriaId)
      .eq("slug", candidato)
      .maybeSingle();
    return !!data && data.id !== id;
  });

  const campos = { categoria_id: categoriaId, nome, slug, descricao, ordem, ativo };
  const { error } = id
    ? await supabase.from("subcategorias").update(campos).eq("id", id)
    : await supabase.from("subcategorias").insert(campos);

  if (error) return { erro: error.message };
  revalidar();
  return { ok: true };
}

export async function alternarSubcategoria(id: number, ativo: boolean) {
  const sessao = await exigirAdmin();
  if (!sessao) return;
  await sessao.supabase.from("subcategorias").update({ ativo }).eq("id", id);
  revalidar();
}

export async function excluirSubcategoria(
  id: number,
): Promise<EstadoSubcategoria> {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: SEM_PERMISSAO };
  const { supabase } = sessao;

  const { count } = await supabase
    .from("produtos")
    .select("id", { count: "exact", head: true })
    .eq("subcategoria_id", id);

  if (count) {
    return {
      erro: `Esta subcategoria tem ${count} ${count === 1 ? "produto" : "produtos"}. Mova-os antes, ou apenas desative.`,
    };
  }

  const { error } = await supabase.from("subcategorias").delete().eq("id", id);
  if (error) return { erro: error.message };
  revalidar();
  return { ok: true };
}
