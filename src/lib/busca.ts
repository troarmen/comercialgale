import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/tipos";

/**
 * Busca de produtos — usada pelo catálogo e pela lista do painel.
 *
 * POR QUE NÃO SÓ O TSVECTOR (nov/2026): o documento `produtos.busca` junta
 * título, referência, tags e descrição, mas NÃO o nome da marca — buscar
 * "Izitex" dava 0 produtos. Ele também exige a palavra inteira ("pijam" não
 * acha nada), não acha referência digitada sem espaço ("mf307") e é sensível a
 * acento ("calca" não acha "Calça").
 *
 * Como funciona agora, sem depender de migração no banco:
 *   • a busca é quebrada em palavras; TODAS precisam aparecer no produto
 *     (cada palavra vira um `.or()`, e o PostgREST junta os `.or()` com E);
 *   • cada palavra pode aparecer no nome, na referência, na descrição, nas
 *     tags (singular ou plural) OU ser o nome da marca, da categoria ou da
 *     subcategoria;
 *   • a comparação de texto é por expressão regular sem diferenciar acento
 *     nem maiúscula: "calca" vira `c[aá…]l[cç][aá…]`;
 *   • numa referência, letra e número podem vir colados ou separados:
 *     "mf307" acha "MF 307".
 *
 * Tudo que entra no filtro passa por `palavrasDaBusca`, que só deixa letras,
 * números e hífen — nada que quebre a sintaxe do `.or()` do PostgREST nem a
 * expressão regular.
 */

type Cliente = SupabaseClient<Database>;

const MAX_PALAVRAS = 6;

// Maiúsculas acentuadas entram explícitas: em banco com LC_CTYPE "C" o `~*`
// não dobra caixa fora do ASCII.
const VARIANTES: Record<string, string> = {
  a: "aáàâãäÁÀÂÃÄ",
  e: "eéèêëÉÈÊË",
  i: "iíìîïÍÌÎÏ",
  o: "oóòôõöÓÒÔÕÖ",
  u: "uúùûüÚÙÛÜ",
  c: "cçÇ",
  n: "nñÑ",
};

/** Tira acento e põe em minúscula: "Calça" -> "calca". */
export function semAcento(texto: string) {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Palavras úteis da busca, já limpas. Vazio = sem busca. */
export function palavrasDaBusca(busca: string | undefined | null): string[] {
  if (!busca) return [];
  const vistas = new Set<string>();
  const palavras: string[] = [];
  for (const bruta of busca.normalize("NFC").split(/\s+/)) {
    const palavra = bruta.replace(/[^\p{L}\p{N}-]/gu, "").replace(/^-+|-+$/g, "");
    // Uma letra solta ("A" de "MF 307 A") não filtra nada de útil e casaria
    // com quase todo produto; número de um dígito ainda serve (tamanho, ref).
    if (palavra.length < 2 && !/^\d$/.test(palavra)) continue;
    const chave = semAcento(palavra);
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    palavras.push(palavra);
    if (palavras.length === MAX_PALAVRAS) break;
  }
  return palavras;
}

/**
 * Expressão regular que acha a palavra ignorando acento e caixa, e que aceita
 * espaço ou hífen opcional entre letra e número ("mf307" ~ "MF 307").
 */
export function regexSemAcento(palavra: string) {
  const base = semAcento(palavra);
  let saida = "";
  for (let i = 0; i < base.length; i++) {
    const ch = base[i];
    const anterior = base[i - 1];
    if (
      anterior &&
      ((/\p{L}/u.test(anterior) && /\d/.test(ch)) ||
        (/\d/.test(anterior) && /\p{L}/u.test(ch)))
    ) {
      saida += "[ -]?";
    }
    saida += VARIANTES[ch] ? `[${VARIANTES[ch]}]` : ch;
  }
  return saida;
}

type Nomeado = { id: number; nome: string };

function idsQueContem(lista: Nomeado[], palavra: string) {
  const alvo = semAcento(palavra);
  return lista.filter((x) => semAcento(x.nome).includes(alvo)).map((x) => x.id);
}

/**
 * Monta os grupos de condição da busca: um texto de `.or()` por palavra.
 * Quem chama aplica cada um com `consulta.or(grupo)`.
 *
 * Lê marcas, categorias e subcategorias com o MESMO cliente da consulta, então
 * o RLS vale igual: o catálogo só casa com marca ativa; o painel, com todas.
 */
export async function gruposDaBusca(
  supabase: Cliente,
  busca: string | undefined | null,
): Promise<string[]> {
  const palavras = palavrasDaBusca(busca);
  if (!palavras.length) return [];

  const [{ data: fabricantes }, { data: categorias }, { data: subcategorias }] =
    await Promise.all([
      supabase.from("fabricantes").select("id, nome"),
      supabase.from("categorias").select("id, nome"),
      supabase.from("subcategorias").select("id, nome"),
    ]);

  return palavras.map((palavra) => {
    // Plural: "calcinhas" procura "calcinha" e aceita o "s" de volta no texto.
    const base = semAcento(palavra);
    const singular =
      base.length > 3 && base.endsWith("s") && !base.endsWith("ss")
        ? base.slice(0, -1)
        : base;
    const rx = regexSemAcento(singular);

    // `\m` e `\M` são início e fim de palavra no regex do Postgres. Dentro do
    // valor entre aspas do PostgREST a barra precisa CHEGAR dobrada (`\\m`;
    // com uma só ele descarta a barra e nada casa) — daí as quatro no fonte.
    //   nome:       começo de palavra ("pijam" acha "Pijama")
    //   referência: qualquer trecho ("604" acha "6041")
    //   descrição:  palavra inteira, com plural ("calca" acha "calças", mas
    //               não "calcanhar")
    //   tags:       a palavra exata, no singular ou no plural
    //
    // O tsvector `busca` ficou de fora de propósito: o radical do português
    // junta "calca" com "calcinhas" e "calçado", e a busca por "calça" vinha
    // cheia de calcinha e meia.
    const partes = [
      `titulo.imatch."\\\\m${rx}"`,
      `modelo.imatch."${regexSemAcento(base)}"`,
      `descricao.imatch."\\\\m${rx}(s|es)?\\\\M"`,
      `tags.ov.{"${singular}","${singular}s","${palavra.toLowerCase()}"}`,
    ];
    const fab = idsQueContem(fabricantes ?? [], palavra);
    const cat = idsQueContem(categorias ?? [], singular);
    const sub = idsQueContem(subcategorias ?? [], singular);
    if (fab.length) partes.push(`fabricante_id.in.(${fab.join(",")})`);
    if (cat.length) partes.push(`categoria_id.in.(${cat.join(",")})`);
    if (sub.length) partes.push(`subcategoria_id.in.(${sub.join(",")})`);
    return partes.join(",");
  });
}
