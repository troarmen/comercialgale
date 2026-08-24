import Image from "next/image";
import Link from "next/link";
import type { FaixaPreco, ProdutoResumo } from "@/lib/catalogo";
import { faixaPreco, urlFoto } from "@/lib/formato";

/**
 * Cartão da vitrine. Preço só aparece quando a view devolveu faixa — para o
 * visitante, o cartão convida para o cadastro em vez de mostrar valor.
 */
export function CartaoProduto({
  produto,
  faixa,
  prioridade = false,
}: {
  produto: ProdutoResumo;
  faixa?: FaixaPreco;
  prioridade?: boolean;
}) {
  const foto =
    produto.produto_imagens.find((i) => i.principal) ?? produto.produto_imagens[0];
  const pecas = produto.kits?.pecas ?? 1;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-borda/60 bg-superficie shadow-pousada transition duration-200 ease-out hover:-translate-y-1 hover:shadow-flutuante">
      <div className="relative aspect-square overflow-hidden bg-white">
        {foto ? (
          <Image
            src={urlFoto(foto.storage_path)!}
            alt={foto.alt ?? `${produto.titulo} — ref. ${produto.modelo}`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            priority={prioridade}
            className="object-contain p-3 transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-xs text-tenue">
            sem foto
          </span>
        )}
        {produto.lancamento && (
          <span className="absolute left-3 top-3 rounded-full bg-acento px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-suave">
            Lançamento
          </span>
        )}
        {/* convite discreto que só aparece no hover — no toque, o cartão
            inteiro já é o link */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 right-3 translate-y-1 rounded-full bg-superficie/95 px-3 py-1.5 text-xs font-semibold text-texto opacity-0 shadow-flutuante backdrop-blur transition duration-200 group-hover:translate-y-0 group-hover:opacity-100"
        >
          Ver produto →
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        {produto.fabricantes && (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-tenue">
            {produto.fabricantes.nome}
          </p>
        )}
        <h3 className="text-sm font-medium leading-snug text-texto">
          <Link
            href={`/produto/${produto.slug}`}
            className="after:absolute after:inset-0 after:content-['']"
          >
            {produto.titulo}
          </Link>
        </h3>
        <p className="text-xs text-suave">
          Ref. {produto.modelo} · kit c/ {pecas} {pecas === 1 ? "peça" : "peças"}
        </p>

        <div className="mt-auto pt-2">
          {faixa ? (
            <>
              <p className="text-base font-semibold tabular-nums text-texto">
                {faixaPreco(faixa.kitMin, faixa.kitMax)}
                <span className="text-xs font-normal text-suave"> /kit</span>
              </p>
              {pecas > 1 && (
                <p className="text-xs tabular-nums text-suave">
                  {faixaPreco(faixa.unitarioMin, faixa.unitarioMax)} por peça
                </p>
              )}
            </>
          ) : (
            <p className="flex items-center gap-1.5 text-xs font-medium text-tenue">
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                <rect x="3.5" y="7" width="9" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" strokeWidth="1.4" />
              </svg>
              Preço para clientes cadastrados
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

/** Grade responsiva da vitrine. */
export function GradeProdutos({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}
