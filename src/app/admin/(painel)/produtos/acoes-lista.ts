"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin, SEM_PERMISSAO } from "@/lib/sessao";

export type ResultadoLote = { ok?: boolean; erro?: string; alterados?: number };

/*
 * Teto por chamada. A tela manda no máximo uma página (25 produtos); o teto
 * só existe porque a action é um endpoint público — ninguém deve conseguir
 * mandar uma lista de milhares de ids numa requisição só.
 */
const MAXIMO = 100;

/**
 * Marca ou tira de lançamento um ou vários produtos, direto da lista
 * (pedido do cliente, nov/2026: "tirar de tempos em tempos o que não é mais
 * novidade" sem abrir produto por produto).
 *
 * É a mesma coluna `produtos.lancamento` que a loja usa na página
 * /lancamentos, na prateleira da página inicial e no selo do cartão.
 */
export async function definirLancamento(
  ids: number[],
  lancamento: boolean,
): Promise<ResultadoLote> {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: SEM_PERMISSAO };
  const { supabase, user } = sessao;

  // O navegador manda o que quiser: só passam ids inteiros positivos.
  const alvo = Array.isArray(ids)
    ? [...new Set(ids)].filter((n) => Number.isSafeInteger(n) && n > 0)
    : [];
  if (typeof lancamento !== "boolean" || !alvo.length) {
    return { erro: "Nenhum produto selecionado." };
  }
  if (alvo.length > MAXIMO) {
    return { erro: `Selecione no máximo ${MAXIMO} produtos de cada vez.` };
  }

  // Só grava onde o valor de fato muda: quem já estava no estado pedido não
  // ganha `updated_at` novo (o sitemap usa essa data como "última mudança")
  // nem linha no histórico.
  const { data, error } = await supabase
    .from("produtos")
    .update({ lancamento })
    .in("id", alvo)
    .neq("lancamento", lancamento)
    .select("id");
  if (error) return { erro: "Não foi possível salvar. Tente de novo." };

  const alterados = data ?? [];
  if (alterados.length) {
    await supabase.from("log_atividades").insert(
      alterados.map((p) => ({
        user_id: user.id,
        acao: "editou",
        entidade: "produto",
        entidade_id: String(p.id),
        detalhes: { campo: "lancamento", novo: lancamento, em_lote: alvo.length > 1 },
      })),
    );
  }

  // Painel (lista e fichas) e as telas da loja que mostram lançamento: a
  // página /lancamentos, a prateleira da inicial, o selo nos cartões das
  // vitrines (catálogo, categorias, marcas) e o selo na ficha do produto.
  revalidatePath("/admin/produtos", "layout");
  revalidatePath("/");
  revalidatePath("/lancamentos");
  revalidatePath("/produtos", "layout");
  revalidatePath("/marcas", "layout");
  revalidatePath("/produto/[...caminho]", "page");

  return { ok: true, alterados: alterados.length };
}
