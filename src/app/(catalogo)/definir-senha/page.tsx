import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { sessaoCatalogo } from "@/lib/catalogo";
import { FormularioSenha } from "./formulario";

export const metadata: Metadata = {
  title: "Criar senha",
  robots: { index: false, follow: false },
  // O token de uso único está na URL: não vaza para fontes/scripts de fora.
  referrer: "no-referrer",
};

export default async function PaginaDefinirSenha(props: {
  searchParams: Promise<{ token_hash?: string }>;
}) {
  const { token_hash } = await props.searchParams;
  const token = token_hash?.trim() || null;
  const { user } = await sessaoCatalogo();

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-14">
      <div className="text-center">
        <Image src="/coracao-gale.png" alt="" width={256} height={256} className="mx-auto h-12 w-12" />
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-texto">
          {token ? "Crie a sua senha" : "Trocar a senha"}
        </h1>
        <p className="mt-1 text-sm text-suave">
          Depois de salvar, você já entra na sua conta.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-borda/60 bg-superficie p-6 shadow-suave">
        {token || user ? (
          <FormularioSenha token={token} />
        ) : (
          <div className="text-center">
            <p className="text-sm text-suave">
              Para criar uma senha, use o link que enviamos por e-mail.
            </p>
            <Link
              href="/esqueci-senha"
              className="mt-4 inline-flex h-11 items-center rounded-full bg-acento px-6 text-sm font-semibold text-white transition hover:bg-acento-forte"
            >
              Receber o link por e-mail
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
