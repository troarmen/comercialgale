"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CategoriaMenu } from "@/lib/catalogo";

/**
 * Navegação principal do catálogo.
 *
 * Desktop: barra com as categorias; cada uma abre um painel com as
 * subcategorias no hover ou no foco do teclado (CSS puro, sem estado).
 * Mobile: gaveta própria com sanfona por categoria — não é a versão desktop
 * espremida.
 */

const FIXOS = [
  { href: "/lancamentos", nome: "Lançamentos", destaque: true },
  { href: "/marcas", nome: "Marcas", destaque: false },
  { href: "/empresa", nome: "A Galé", destaque: false },
  { href: "/contato", nome: "Contato", destaque: false },
];

export function NavDesktop({ categorias }: { categorias: CategoriaMenu[] }) {
  return (
    <nav aria-label="Categorias" className="hidden border-t border-borda lg:block">
      <div className="mx-auto flex max-w-7xl items-center gap-1 px-4">
        <Link
          href="/produtos"
          className="whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold text-texto transition hover:bg-superficie-2 hover:text-acento-texto"
        >
          Todos os produtos
        </Link>

        {categorias.map((c) => (
          <div key={c.id} className="group relative">
            <Link
              href={`/produtos/${c.slug}`}
              className="flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium text-suave transition hover:bg-superficie-2 hover:text-texto group-focus-within:bg-superficie-2"
            >
              {c.nome}
              {c.subcategorias.length > 0 && (
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-tenue" aria-hidden="true">
                  <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </Link>

            {c.subcategorias.length > 0 && (
              <div className="invisible absolute left-0 top-full z-40 min-w-56 translate-y-1 pt-1 opacity-0 transition duration-150 ease-out group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                <div className="overflow-hidden rounded-xl border border-borda bg-superficie shadow-flutuante">
                  <ul className="max-h-[70vh] overflow-y-auto py-2 rolagem-fina">
                    {c.subcategorias.map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/produtos/${c.slug}/${s.slug}`}
                          className="block px-4 py-2 text-sm text-suave transition hover:bg-superficie-2 hover:text-acento-texto"
                        >
                          {s.nome}
                        </Link>
                      </li>
                    ))}
                    <li className="mt-1 border-t border-borda pt-1">
                      <Link
                        href={`/produtos/${c.slug}`}
                        className="block px-4 py-2 text-sm font-semibold text-acento-texto transition hover:bg-superficie-2"
                      >
                        Ver tudo em {c.nome}
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        ))}

        <span className="mx-1 h-5 w-px bg-borda" aria-hidden="true" />

        {FIXOS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-superficie-2 ${
              item.destaque
                ? "text-acento-texto hover:text-acento-forte"
                : "text-suave hover:text-texto"
            }`}
          >
            {item.nome}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function MenuMovel({ categorias }: { categorias: CategoriaMenu[] }) {
  const [aberto, setAberto] = useState(false);
  const caminho = usePathname();

  // Navegou? Fecha a gaveta. Ajuste de estado DURANTE a renderização (padrão
  // recomendado pelo React para reagir a mudança de prop sem efeito).
  const [caminhoAnterior, setCaminhoAnterior] = useState(caminho);
  if (caminho !== caminhoAnterior) {
    setCaminhoAnterior(caminho);
    setAberto(false);
  }

  // Gaveta aberta não deve rolar a página atrás dela.
  useEffect(() => {
    document.body.style.overflow = aberto ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [aberto]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Abrir menu"
        aria-expanded={aberto}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-borda bg-superficie text-texto transition hover:bg-superficie-2"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {/*
        Portal para o <body>: o cabeçalho usa backdrop-blur, e backdrop-filter
        num ancestral vira "containing block" — um fixed lá dentro ficaria
        preso à caixa do cabeçalho em vez de cobrir a tela.
      */}
      {aberto &&
        createPortal(
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setAberto(false)}
            className="absolute inset-0 bg-black/45"
          />
          <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col bg-superficie shadow-flutuante">
            <div className="flex items-center justify-between border-b border-borda px-4 py-3">
              <span className="rounded-lg bg-(--logo-placa) px-1 py-0.5">
                <Image
                  src="/logo-gale.png"
                  alt="Comercial Galé"
                  width={187}
                  height={143}
                  className="h-10 w-auto"
                />
              </span>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar menu"
                className="flex h-9 w-9 items-center justify-center rounded-full text-suave transition hover:bg-superficie-2 hover:text-texto"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <nav aria-label="Categorias" className="flex-1 overflow-y-auto px-2 py-3 rolagem-fina">
              <Link
                href="/produtos"
                className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-texto transition hover:bg-superficie-2"
              >
                Todos os produtos
              </Link>

              {categorias.map((c) => (
                <details key={c.id} className="group/det">
                  <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-texto transition hover:bg-superficie-2 [&::-webkit-details-marker]:hidden">
                    {c.nome}
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      className="h-4 w-4 text-tenue transition group-open/det:rotate-180"
                      aria-hidden="true"
                    >
                      <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </summary>
                  <ul className="mb-1 ml-2 border-l border-borda pl-2">
                    <li>
                      <Link
                        href={`/produtos/${c.slug}`}
                        className="block rounded-lg px-3 py-2 text-sm font-medium text-acento-texto transition hover:bg-superficie-2"
                      >
                        Ver tudo em {c.nome}
                      </Link>
                    </li>
                    {c.subcategorias.map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/produtos/${c.slug}/${s.slug}`}
                          className="block rounded-lg px-3 py-2 text-sm text-suave transition hover:bg-superficie-2 hover:text-texto"
                        >
                          {s.nome}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}

              <div className="my-2 border-t border-borda" />

              {FIXOS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-superficie-2 ${
                    item.destaque ? "text-acento-texto" : "text-texto"
                  }`}
                >
                  {item.nome}
                </Link>
              ))}
            </nav>
          </div>
        </div>,
          document.body,
        )}
    </div>
  );
}
