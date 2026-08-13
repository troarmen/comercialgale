const MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const NUMERO = new Intl.NumberFormat("pt-BR");

export function reais(valor: number | null | undefined) {
  return MOEDA.format(valor ?? 0);
}

export function numero(valor: number | null | undefined) {
  return NUMERO.format(valor ?? 0);
}

/**
 * Faixa de preço de um produto.
 *
 * A maioria dos produtos tem preço único, mas alguns cobram mais nos tamanhos
 * grandes (54/56, 58/60). Mostrar só o menor esconderia isso do Arthur; mostrar
 * a faixa deixa evidente que há variação sem poluir a tabela.
 */
export function faixaPreco(min: number, max: number) {
  if (!min && !max) return "—";
  return min === max ? reais(min) : `${reais(min)} – ${reais(max)}`;
}

/** URL pública de uma foto no Storage. O bucket é público para leitura. */
export function urlFoto(caminho: string | null | undefined) {
  if (!caminho) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/produtos/${caminho}`;
}
