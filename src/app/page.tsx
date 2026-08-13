import Link from "next/link";
import { Coracao } from "@/components/marca";

/**
 * Placeholder do catálogo dos clientes.
 * Por decisão do projeto, o painel do administrador é feito por completo antes
 * de começarmos esta parte.
 */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <Coracao className="h-10 w-10 text-gale-500" />
      <h1 className="text-2xl font-semibold tracking-tight text-texto">
        Galé Comercial
      </h1>
      <p className="max-w-md text-sm text-suave">
        O catálogo de atacado está em construção.
      </p>
      <Link
        href="/admin"
        className="mt-2 text-sm font-medium text-acento-texto underline underline-offset-4 hover:text-acento-forte"
      >
        Acessar o painel
      </Link>
    </main>
  );
}
