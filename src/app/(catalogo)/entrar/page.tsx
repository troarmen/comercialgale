import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sessaoCatalogo } from "@/lib/catalogo";
import { FormularioEntrar } from "./formulario";

export const metadata: Metadata = {
  title: "Entrar na conta",
  description:
    "Acesse a sua conta de lojista da Comercial Galé para ver preços de atacado e fechar pedidos.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/entrar" },
};

export default async function PaginaEntrar(props: {
  searchParams: Promise<{ destino?: string }>;
}) {
  const { user } = await sessaoCatalogo();
  const { destino } = await props.searchParams;
  // Só volta para caminhos internos — destino vindo de fora não é confiável.
  const voltarPara =
    destino?.startsWith("/") && !destino.startsWith("//") ? destino : "/";
  if (user) redirect(voltarPara);

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-14">
      <div className="text-center">
        <Image src="/coracao-gale.png" alt="" width={256} height={256} className="mx-auto h-12 w-12" />
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-texto">
          Entrar na sua conta
        </h1>
        <p className="mt-1 text-sm text-suave">
          O login libera os preços de atacado e o fechamento de pedidos.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-borda/60 bg-superficie p-6 shadow-suave">
        <FormularioEntrar destino={voltarPara} />
      </div>

      <p className="mt-6 text-center text-sm text-suave">
        Ainda não compra com a Galé?{" "}
        <Link
          href="/cadastro"
          className="font-semibold text-acento-texto transition hover:text-acento-forte"
        >
          Cadastre a sua loja
        </Link>
      </p>
    </div>
  );
}
