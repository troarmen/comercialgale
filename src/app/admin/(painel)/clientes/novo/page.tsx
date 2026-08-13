import type { Metadata } from "next";
import Link from "next/link";
import { CLIENTE_VAZIO, FormularioCliente } from "../[id]/formulario";
import { criarCliente } from "./acoes";

export const metadata: Metadata = { title: "Novo cliente · Galé Comercial" };

export default function PaginaNovoCliente() {
  return (
    <div className="px-8 py-7">
      <nav className="mb-3 text-sm text-suave">
        <Link href="/admin/clientes" className="transition hover:text-texto">
          Clientes
        </Link>
        <span className="px-1.5 text-tenue">/</span>
        <span className="text-texto">Novo</span>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-texto">
          Novo cliente
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-suave">
          Depois de salvar, você cai na ficha do cliente — é lá que fica o botão
          para criar o login e liberar os preços para ele.
        </p>
      </header>

      <div className="max-w-3xl">
        <FormularioCliente
          c={CLIENTE_VAZIO}
          aoSalvar={criarCliente}
          rotulo="Cadastrar cliente"
        />
      </div>
    </div>
  );
}
