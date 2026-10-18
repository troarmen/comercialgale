import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { arvoreCategorias, configPublica, sessaoCatalogo } from "@/lib/catalogo";
import { BuscaGlobal } from "./busca-global";
import { CarrinhoBotao } from "./carrinho-botao";
import { MenuMovel, NavDesktop } from "./nav-principal";

/**
 * Logotipo oficial da Galé — edição 50 anos (coração + faixa "50 ANOS · 2026").
 * O arquivo tem texto carvão sobre fundo transparente; no tema escuro a
 * `--logo-placa` pinta uma placa branca atrás para ele continuar legível.
 */
export function MarcaCatalogo({ compacta = false }: { compacta?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Comercial Galé — página inicial"
      className="shrink-0 rounded-xl bg-(--logo-placa) px-1.5 py-1 transition hover:opacity-90"
    >
      <Image
        src="/logo-gale.png"
        alt="Galé Super Atacado — 50 anos de tradição"
        width={460}
        height={426}
        priority
        className={compacta ? "h-12 w-auto" : "h-14 w-auto sm:h-16"}
      />
    </Link>
  );
}

async function AreaConta() {
  const { cliente, user } = await sessaoCatalogo();

  if (user && cliente) {
    // nome completo truncado via CSS — cortar na primeira palavra viraria
    // "Loja" para uma "Loja da Maria"
    const nome = cliente.nome_fantasia || cliente.nome;
    return (
      <Link
        href="/conta"
        className="flex h-10 items-center gap-2 rounded-full border border-borda bg-superficie px-3.5 text-sm font-medium text-texto transition hover:border-borda-forte hover:bg-superficie-2 hover:shadow-pousada"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5 text-suave" aria-hidden="true">
          <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.7" />
          <path d="M5.5 19.4c1-3 3.5-4.6 6.5-4.6s5.5 1.6 6.5 4.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <span className="hidden max-w-28 truncate sm:inline">{nome}</span>
      </Link>
    );
  }

  // Logado mas sem cadastro de cliente (ex.: admin) — manda para o painel.
  if (user) {
    return (
      <Link
        href="/admin"
        className="flex h-10 items-center rounded-full border border-borda bg-superficie px-3.5 text-sm font-medium text-texto transition hover:bg-superficie-2"
      >
        Painel
      </Link>
    );
  }

  return (
    <Link
      href="/entrar"
      className="flex h-10 items-center gap-2 rounded-full border border-borda bg-superficie px-3.5 text-sm font-medium text-texto transition hover:border-borda-forte hover:bg-superficie-2 hover:shadow-pousada"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5 text-suave" aria-hidden="true">
        <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.7" />
        <path d="M5.5 19.4c1-3 3.5-4.6 6.5-4.6s5.5 1.6 6.5 4.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      <span className="hidden sm:inline">Entrar</span>
    </Link>
  );
}

export async function Cabecalho() {
  const [categorias, config] = await Promise.all([
    arvoreCategorias(),
    configPublica(),
  ]);

  return (
    <header className="sticky top-0 z-40 border-b border-borda bg-superficie/95 shadow-pousada backdrop-blur">
      {config.aviso && (
        <p className="bg-carvao-950 px-4 py-1.5 text-center text-xs font-medium text-white">
          {config.aviso}
        </p>
      )}

      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <MenuMovel categorias={categorias} />
        <MarcaCatalogo />

        <div className="hidden flex-1 justify-center px-4 md:flex">
          {/* useSearchParams exige um limite de Suspense fora de página dinâmica */}
          <Suspense fallback={<div className="h-10 w-full max-w-xl" />}>
            <BuscaGlobal />
          </Suspense>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <AreaConta />
          <CarrinhoBotao />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-3 md:hidden">
        <Suspense fallback={<div className="h-10 w-full" />}>
          <BuscaGlobal compacta />
        </Suspense>
      </div>

      <NavDesktop categorias={categorias} />
    </header>
  );
}
