import type { Metadata } from "next";
import { PaginaCarrinhoCliente } from "./pagina-cliente";

export const metadata: Metadata = {
  title: "Meu pedido",
  robots: { index: false, follow: false },
};

export default function PaginaCarrinho() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-texto">
        Meu pedido
      </h1>
      <PaginaCarrinhoCliente />
    </div>
  );
}
