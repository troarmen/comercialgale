import Link from "next/link";

/**
 * Título de coluna que ordena a lista (pedido do cliente, nov/2026: "poder
 * ordenar a lista clicando no título de qualquer coluna").
 *
 * A ordem mora na URL (`?ordem=fabricante&dir=asc`), como a busca e os
 * filtros. Assim ela sobrevive ao recarregar, vai junto no endereço que o
 * Voltar guarda (src/components/voltar.tsx) e não precisa de JavaScript:
 * cada título é um link de verdade. Clicar leva para a página 1 — a página 7
 * de uma ordem não tem nada a ver com a página 7 de outra.
 *
 * Componente de servidor: quem usa passa os parâmetros atuais da URL.
 */

export type Direcao = "asc" | "desc";
export type Ordem<C extends string = string> = { campo: C; dir: Direcao };

/**
 * Lê `ordem` e `dir` da URL aceitando só as colunas conhecidas — o valor vai
 * parar num `.order()` do banco, então nada de texto livre.
 *
 * `colunas` diz, para cada coluna, a direção do PRIMEIRO clique: texto começa
 * de A a Z; data começa pelos mais novos, que é o que se procura.
 */
export function lerOrdem<C extends string>(
  sp: { ordem?: string; dir?: string },
  colunas: Record<C, Direcao>,
  padrao: Ordem<NoInfer<C>>,
): Ordem<C> {
  const campo = (Object.keys(colunas) as C[]).find((c) => c === sp.ordem);
  if (!campo) return padrao;
  const dir: Direcao =
    sp.dir === "asc" || sp.dir === "desc" ? sp.dir : colunas[campo];
  return { campo, dir };
}

const DESCRICAO = {
  texto: { asc: "de A a Z", desc: "de Z a A" },
  data: { asc: "mais antigos primeiro", desc: "mais novos primeiro" },
  /** coluna de sim/não (ex.: Lançamento): "desc" põe os marcados no topo */
  marca: { asc: "marcados por último", desc: "marcados primeiro" },
} as const;

export function CabecalhoOrdenavel({
  campo,
  rotulo,
  ordem,
  primeira,
  tipo = "texto",
  caminho,
  params,
  className = "px-4",
}: {
  campo: string;
  rotulo: string;
  /** Ordem em vigor na lista (já resolvida por `lerOrdem`). */
  ordem: Ordem;
  /** Direção do primeiro clique nesta coluna. */
  primeira: Direcao;
  tipo?: keyof typeof DESCRICAO;
  /** Endereço da lista, sem parâmetros. */
  caminho: string;
  /** Parâmetros atuais da URL (busca, filtros…), preservados no link. */
  params: Record<string, string | string[] | undefined>;
  /** Classes do <th>; o padrão é só o espaçamento lateral (`px-4`). */
  className?: string;
}) {
  const ativa = ordem.campo === campo;
  // segundo clique na mesma coluna inverte
  const proxima: Direcao = ativa ? (ordem.dir === "asc" ? "desc" : "asc") : primeira;

  const novo = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (chave === "pagina" || chave === "ordem" || chave === "dir") continue;
    if (typeof valor === "string" && valor) novo.set(chave, valor);
  }
  novo.set("ordem", campo);
  novo.set("dir", proxima);

  const ariaSort = ativa
    ? ordem.dir === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th scope="col" aria-sort={ariaSort} className={`py-3 font-medium ${className}`}>
      <Link
        href={`${caminho}?${novo}`}
        replace
        scroll={false}
        // Ordenar é raro: não vale a pena pré-carregar a lista em cada ordem
        // possível só porque os títulos estão na tela.
        prefetch={false}
        title={`Ordenar por ${rotulo.toLowerCase()}, ${DESCRICAO[tipo][proxima]}`}
        className={`group inline-flex items-center gap-1 rounded transition hover:text-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gale-500 ${
          ativa ? "text-texto" : ""
        }`}
      >
        {rotulo}
        <Seta ativa={ativa} dir={ordem.dir} />
        {ativa && (
          <span className="sr-only">
            {` (ordenado ${DESCRICAO[tipo][ordem.dir]})`}
          </span>
        )}
      </Link>
    </th>
  );
}

/** ▲ / ▼ na coluna em vigor; nas outras, as duas setas apagadas. */
function Seta({ ativa, dir }: { ativa: boolean; dir: Direcao }) {
  if (!ativa) {
    return (
      <svg
        viewBox="0 0 12 12"
        className="h-3 w-3 opacity-40 transition group-hover:opacity-100"
        aria-hidden="true"
      >
        <path d="M6 1.5 9 5H3zM6 10.5 3 7h6z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3 text-acento-texto" aria-hidden="true">
      {dir === "asc" ? (
        <path d="M6 2 10 8H2z" fill="currentColor" />
      ) : (
        <path d="M6 10 2 4h8z" fill="currentColor" />
      )}
    </svg>
  );
}
