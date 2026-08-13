import type { Metadata } from "next";
import { Coracao } from "@/components/marca";
import { FormularioLogin } from "./formulario";

export const metadata: Metadata = { title: "Entrar · Galé Comercial" };

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string }>;
}) {
  const { destino } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-menu px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <Coracao className="h-11 w-11 text-gale-500" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
            Galé Comercial
          </h1>
          <p className="mt-1.5 text-sm text-tenue">
            Painel de administração
          </p>
        </div>

        <div className="rounded-2xl bg-superficie p-7 shadow-xl shadow-black/25">
          <FormularioLogin destino={destino ?? "/admin"} />
        </div>

        <p className="mt-6 text-center text-xs text-suave">
          Problemas para entrar? Fale com a GoodySEO.
        </p>
      </div>
    </main>
  );
}
