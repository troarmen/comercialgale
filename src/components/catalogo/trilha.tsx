import Link from "next/link";

export type ItemTrilha = { nome: string; href?: string };

/**
 * Breadcrumb do catálogo. O JSON-LD correspondente (BreadcrumbList) é gerado
 * pela página com `dadosTrilha` de src/lib/seo.ts — visual e dado andam juntos.
 */
export function Trilha({ itens }: { itens: ItemTrilha[] }) {
  return (
    <nav aria-label="Você está em" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-suave">
        <li>
          <Link href="/" className="transition hover:text-acento-texto">
            Início
          </Link>
        </li>
        {itens.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 text-tenue" aria-hidden="true">
              <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {item.href ? (
              <Link href={item.href} className="transition hover:text-acento-texto">
                {item.nome}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-texto">
                {item.nome}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
