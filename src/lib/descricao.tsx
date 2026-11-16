import { Fragment, type ReactNode } from "react";

/**
 * Descrição do produto com negrito (pedido do cliente, nov/2026).
 *
 * O site antigo guardava a descrição como pedaço de HTML e o Arthur usava
 * negrito para destacar composição, cuidados, detalhes. Na migração o HTML
 * foi arrancado e o negrito se perdeu.
 *
 * Formato escolhido: a própria coluna `descricao` (text), com o negrito
 * marcado como **assim** — nada de HTML. Três razões:
 *   • zero risco de injeção: a loja monta nós React a partir do texto, sem
 *     dangerouslySetInnerHTML, e um "<script>" digitado vira só texto;
 *   • sem migração: o banco de produção não muda, o texto antigo continua
 *     válido (sem ** ele é simplesmente texto sem negrito);
 *   • o texto continua legível onde ele vira texto puro (meta description,
 *     JSON-LD, busca) — ali tiramos os ** com `textoPuro`.
 *
 * Regras de leitura, as mesmas no editor (prévia) e na loja:
 *   • linha em branco (\n\n) separa parágrafos; \n simples é quebra de linha;
 *   • **trecho** vira <strong>; o negrito não atravessa quebra de linha (o
 *     botão do editor fecha e reabre o ** em cada linha da seleção);
 *   • ** sem par fica como está — aparece na prévia, e o Arthur corrige;
 *     o par vazio (****) some.
 */

const MARCA = "**";
const NEGRITO = /\*\*(.+?)\*\*/g;

/** A descrição sem as marcas de negrito, para onde ela vira texto puro. */
export function textoPuro(descricao: string): string;
export function textoPuro(descricao: string | null | undefined): string | null;
export function textoPuro(descricao: string | null | undefined) {
  if (descricao == null) return null;
  return descricao.split(MARCA).join("");
}

type Trecho = { texto: string; negrito: boolean };

/** Quebra uma linha em trechos normais e em negrito. */
export function trechos(linha: string): Trecho[] {
  const saida: Trecho[] = [];
  let ultimo = 0;
  for (const m of linha.matchAll(NEGRITO)) {
    if (m.index > ultimo) saida.push({ texto: linha.slice(ultimo, m.index), negrito: false });
    saida.push({ texto: m[1], negrito: true });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < linha.length) saida.push({ texto: linha.slice(ultimo), negrito: false });
  return saida;
}

/** Parágrafos (separados por linha em branco), cada um com suas linhas. */
export function paragrafos(descricao: string): string[][] {
  return descricao
    // "****" é o par vazio que o botão deixa quando ninguém digita no meio:
    // some, em vez de aparecer como quatro asteriscos na loja.
    .split(MARCA + MARCA)
    .join("")
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n+/)
    .map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((linhas) => linhas.length > 0);
}

/**
 * A descrição pronta para exibir: <p> por parágrafo, <br> nas quebras de
 * linha e <strong> no negrito. Serve à ficha da loja e à prévia do editor —
 * sem hook nenhum, roda no servidor e no navegador.
 */
export function DescricaoFormatada({
  texto,
  className,
  classeNegrito = "font-semibold text-texto",
}: {
  texto: string;
  className?: string;
  classeNegrito?: string;
}) {
  return (
    <div className={className}>
      {paragrafos(texto).map((linhas, i) => (
        <p key={i}>
          {linhas.map((linha, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {trechos(linha).map((t, k): ReactNode =>
                t.negrito ? (
                  <strong key={k} className={classeNegrito}>
                    {t.texto}
                  </strong>
                ) : (
                  <Fragment key={k}>{t.texto}</Fragment>
                ),
              )}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ editor

/**
 * O que o botão Negrito faz com o texto: troca `texto.slice(inicio, fim)` por
 * `trecho` e deixa selecionado de `selInicio` a `selFim`. Devolver a troca (e
 * não o texto inteiro) deixa o editor aplicá-la com o "desfazer" do navegador
 * funcionando.
 */
export type TrocaNegrito = {
  inicio: number;
  fim: number;
  trecho: string;
  selInicio: number;
  selFim: number;
};

const LETRA = /[\p{L}\p{N}%]/u;

/**
 * Liga ou desliga o negrito na seleção — o mesmo gesto do Ctrl+B de qualquer
 * editor de texto:
 *   • seleção já em negrito (com ou sem os ** dentro dela) → tira o negrito;
 *   • seleção normal → põe ** em volta, linha a linha, sem engolir os
 *     espaços das pontas (senão "** palavra **" não fecharia o par direito);
 *   • sem seleção → age sobre a palavra onde está o cursor; fora de palavra,
 *     abre **** com o cursor no meio para a pessoa digitar.
 */
export function alternarNegrito(texto: string, ini: number, fim: number): TrocaNegrito {
  if (ini > fim) [ini, fim] = [fim, ini];

  // Sem seleção: pega a palavra em volta do cursor.
  if (ini === fim) {
    let a = ini;
    let b = fim;
    while (a > 0 && LETRA.test(texto[a - 1])) a--;
    while (b < texto.length && LETRA.test(texto[b])) b++;
    if (a === b) {
      return { inicio: ini, fim: ini, trecho: MARCA + MARCA, selInicio: ini + 2, selFim: ini + 2 };
    }
    ini = a;
    fim = b;
  }

  // As pontas em branco ficam de fora do negrito.
  while (ini < fim && /\s/.test(texto[ini])) ini++;
  while (fim > ini && /\s/.test(texto[fim - 1])) fim--;
  if (ini === fim) return { inicio: ini, fim, trecho: "", selInicio: ini, selFim: fim };

  const sel = texto.slice(ini, fim);

  // 1) Os ** estão logo fora da seleção: **[palavra]**
  if (texto.slice(ini - 2, ini) === MARCA && texto.slice(fim, fim + 2) === MARCA) {
    return { inicio: ini - 2, fim: fim + 2, trecho: sel, selInicio: ini - 2, selFim: fim - 2 };
  }
  // 2) A seleção inclui os **: [**palavra**]
  if (sel.length > 4 && sel.startsWith(MARCA) && sel.endsWith(MARCA) && !sel.slice(2, -2).includes(MARCA)) {
    const miolo = sel.slice(2, -2);
    return { inicio: ini, fim, trecho: miolo, selInicio: ini, selFim: ini + miolo.length };
  }
  // 3) A seleção está dentro de um trecho em negrito: **um [pedaço] maior**
  const linhaIni = texto.lastIndexOf("\n", ini - 1) + 1;
  const linhaFim = texto.indexOf("\n", fim) === -1 ? texto.length : texto.indexOf("\n", fim);
  if (!sel.includes("\n")) {
    const linha = texto.slice(linhaIni, linhaFim);
    for (const m of linha.matchAll(NEGRITO)) {
      const a = linhaIni + m.index;
      const b = a + m[0].length;
      if (a <= ini && fim <= b) {
        const miolo = m[1];
        return {
          inicio: a,
          fim: b,
          trecho: miolo,
          selInicio: Math.max(a, ini - 2),
          selFim: Math.min(a + miolo.length, fim - 2),
        };
      }
    }
  }

  // 4) Várias linhas, todas já em negrito: tira o negrito de todas.
  const cheias = sel.split("\n").map((l) => l.trim()).filter(Boolean);
  if (cheias.length > 1 && cheias.every((l) => /^\*\*(.+?)\*\*$/.test(l) && !l.slice(2, -2).includes(MARCA))) {
    const miolo = sel.split(MARCA).join("");
    return { inicio: ini, fim, trecho: miolo, selInicio: ini, selFim: ini + miolo.length };
  }

  // 5) Seleção que corta um negrito no meio ("c **de" em "abc **def**"):
  // estica até o fim do negrito cortado, senão sobraria um ** sem par.
  for (const m of texto.matchAll(NEGRITO)) {
    const a = m.index;
    const b = a + m[0].length;
    if (a < ini && ini < b) ini = a;
    if (a < fim && fim < b) fim = b;
  }
  const marcado = texto.slice(ini, fim);

  // 6) Põe o negrito. Marcas soltas dentro da seleção saem antes, para não
  // aninhar; cada linha ganha o seu par.
  const limpo = marcado.split(MARCA).join("");
  const trecho = limpo
    .split("\n")
    .map((linha) => {
      const m = linha.match(/^(\s*)(.*?)(\s*)$/)!;
      return m[2] ? `${m[1]}${MARCA}${m[2]}${MARCA}${m[3]}` : linha;
    })
    .join("\n");
  // Numa linha só, a seleção fica no texto (sem os **), como estava: um
  // segundo Ctrl+B desfaz. Em várias linhas, seleciona o bloco todo.
  return trecho.includes("\n")
    ? { inicio: ini, fim, trecho, selInicio: ini, selFim: ini + trecho.length }
    : { inicio: ini, fim, trecho, selInicio: ini + 2, selFim: ini + trecho.length - 2 };
}
