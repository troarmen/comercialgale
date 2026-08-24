import type { Metadata } from "next";
import Link from "next/link";
import { configPublica } from "@/lib/catalogo";
import { reais } from "@/lib/formato";
import { FormularioCadastro } from "./formulario";

export const metadata: Metadata = {
  title: "Cadastro de Lojista — Compre no Atacado",
  description:
    "Cadastre a sua loja na Comercial Galé e compre lingerie, meias, cuecas e pijamas no atacado. Cadastro gratuito; preços liberados após aprovação.",
  alternates: { canonical: "/cadastro" },
};

export default async function PaginaCadastro() {
  const config = await configPublica();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="max-w-xl">
        <h1 className="text-3xl font-bold tracking-tight text-texto">
          Cadastre a sua loja
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-suave">
          O catálogo é aberto; o preço de atacado é para lojistas cadastrados.
          Preencha os dados, aguarde a liberação e compre online
          {config.pedidoMinimo > 0 &&
            ` — pedido mínimo de ${reais(config.pedidoMinimo)}`}
          . Já tem login?{" "}
          <Link href="/entrar" className="font-semibold text-acento-texto">
            Entre por aqui
          </Link>
          .
        </p>
      </header>

      <div className="relative mt-7">
        <FormularioCadastro />
      </div>
    </div>
  );
}
