import { redirect } from "next/navigation";
import { cache } from "react";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * Quem pode estar no painel, e com que poder.
 *
 *   admin       — tudo.
 *   colaborador — SÓ LÊ pedidos (migração 007). Não vê clientes, produtos,
 *                 cadastros nem configurações, e não muda nada.
 *
 * Duas camadas, de propósito: o RLS é quem de fato protege o dado; as funções
 * abaixo dão mensagem clara e escondem o que a pessoa não pode usar.
 */
export type Papel = "admin" | "colaborador";

export const SEM_PERMISSAO = "Sessão expirada ou sem permissão. Entre novamente.";

/**
 * Perfil de quem está no painel, ou null se não for da equipe (visitante,
 * lojista do catálogo, conta desativada). `cache` faz layout e página
 * dividirem a mesma consulta dentro da requisição.
 */
export const perfilEquipe = cache(async () => {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase
    .from("profiles")
    .select("nome, role, ativo")
    .eq("id", user.id)
    .single();
  if (!perfil?.ativo) return null;
  if (perfil.role !== "admin" && perfil.role !== "colaborador") return null;
  const papel: Papel = perfil.role;
  return { supabase, user, nome: perfil.nome, papel };
});

/**
 * Guard das Server Actions do painel.
 *
 * O `layout.tsx` do painel NÃO protege Server Action: a action é um endpoint
 * próprio, chamável com qualquer sessão válida — inclusive a de um lojista do
 * catálogo. Toda action que escreve precisa chamar `exigirAdmin()` antes de
 * tocar no banco.
 *
 * O RLS barraria a escrita de qualquer forma, mas em silêncio (UPDATE/DELETE
 * sem política afetam 0 linhas e não dão erro) — e onde a action usa a
 * service_role (Storage, Auth admin), não há RLS nenhum para barrar.
 */
export async function exigirAdmin() {
  const perfil = await perfilEquipe();
  if (perfil?.papel !== "admin") return null;
  return { supabase: perfil.supabase, user: perfil.user };
}

/**
 * Guard das seções só de admin (produtos, clientes, cadastros, configurações,
 * equipe, início). Colaborador volta para a única tela que é dele.
 */
export async function exigirAdminPagina() {
  const perfil = await perfilEquipe();
  if (!perfil) redirect("/admin/login");
  if (perfil.papel !== "admin") redirect("/admin/pedidos");
  return perfil;
}
