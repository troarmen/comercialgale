import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FormularioEsqueci } from "./formulario";

export const metadata: Metadata = {
  title: "Esqueci minha senha",
  robots: { index: false, follow: true },
  alternates: { canonical: "/esqueci-senha" },
};

export default function PaginaEsqueciSenha() {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-14">
      <div className="text-center">
        <Image src="/coracao-gale.png" alt="" width={256} height={256} className="mx-auto h-12 w-12" />
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-texto">
          Esqueci minha senha
        </h1>
        <p className="mt-1 text-sm text-suave">
          Mandamos um link para você criar uma senha nova.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-borda/60 bg-superficie p-6 shadow-suave">
        <FormularioEsqueci />
      </div>

      <p className="mt-6 text-center text-sm text-suave">
        Lembrou?{" "}
        <Link
          href="/entrar"
          className="font-semibold text-acento-texto transition hover:text-acento-forte"
        >
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}
