"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlternarTema } from "@/components/alternar-tema";
import { Marca } from "@/components/marca";

type Item = {
  href: string;
  nome: string;
  icone: React.ReactNode;
  contador?: number;
};

const I = ({ d }: { d: string }) => (
  <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
    <path d={d} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function MenuLateral({
  pedidosNovos,
  nomeUsuario,
  aoSair,
}: {
  pedidosNovos: number;
  nomeUsuario: string;
  aoSair: () => Promise<void>;
}) {
  const caminho = usePathname();

  const itens: Item[] = [
    { href: "/admin", nome: "Painel", icone: <I d="M3 10.5 10 4l7 6.5M5 9.5V16h10V9.5" /> },
    { href: "/admin/pedidos", nome: "Pedidos", contador: pedidosNovos, icone: <I d="M5 3h10v14l-5-3-5 3V3ZM7.5 7h5M7.5 10h3" /> },
    { href: "/admin/produtos", nome: "Produtos", icone: <I d="M10 2.5 17 6v8l-7 3.5L3 14V6l7-3.5ZM3 6l7 3.5L17 6M10 9.5v8" /> },
    { href: "/admin/clientes", nome: "Clientes", icone: <I d="M13 16v-1.5A2.5 2.5 0 0 0 10.5 12h-4A2.5 2.5 0 0 0 4 14.5V16M8.5 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM16 16v-1.5a2.5 2.5 0 0 0-1.9-2.4M12.5 4.6a2.5 2.5 0 0 1 0 4.8" /> },
    { href: "/admin/cadastros", nome: "Cadastros", icone: <I d="M4 6h12M4 10h12M4 14h7" /> },
    { href: "/admin/configuracoes", nome: "Configurações", icone: <I d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM16 10c0-.4 0-.8-.1-1.2l1.4-1-1.5-2.6-1.6.6a6 6 0 0 0-2-1.2L11.8 3H8.2l-.4 1.6a6 6 0 0 0-2 1.2l-1.6-.6L2.7 7.8l1.4 1a6 6 0 0 0 0 2.4l-1.4 1 1.5 2.6 1.6-.6a6 6 0 0 0 2 1.2l.4 1.6h3.6l.4-1.6a6 6 0 0 0 2-1.2l1.6.6 1.5-2.6-1.4-1c.1-.4.1-.8.1-1.2Z" /> },
  ];

  const ativo = (href: string) =>
    href === "/admin" ? caminho === "/admin" : caminho.startsWith(href);

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-menu">
      <div className="flex items-center justify-between gap-2 px-5 py-5">
        <Marca />
        <AlternarTema />
      </div>

      <nav className="rolagem-fina flex-1 overflow-y-auto px-3 pb-4">
        <ul className="flex flex-col gap-0.5">
          {itens.map((item) => {
            const on = ativo(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={on ? "page" : undefined}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    on
                      ? "bg-menu-ativo font-medium text-white"
                      : "text-menu-texto hover:bg-menu-item hover:text-white"
                  }`}
                >
                  <span className={on ? "text-gale-400" : "text-menu-texto/70 group-hover:text-menu-texto"}>
                    {item.icone}
                  </span>
                  <span className="flex-1">{item.nome}</span>
                  {!!item.contador && (
                    <span className="rounded-full bg-acento px-2 py-0.5 text-[11px] font-semibold text-white">
                      {item.contador}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-menu-borda p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-menu-ativo text-xs font-semibold text-white/80">
            {nomeUsuario.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">{nomeUsuario}</div>
            <div className="text-[11px] text-menu-texto/70">Administrador</div>
          </div>
        </div>
        <form action={aoSair}>
          <button
            type="submit"
            className="mt-1 w-full rounded-lg px-2 py-2 text-left text-sm text-menu-texto transition hover:bg-menu-item hover:text-white"
          >
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
