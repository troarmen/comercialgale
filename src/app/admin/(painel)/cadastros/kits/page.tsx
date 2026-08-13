import type { Metadata } from "next";
import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { GerenciadorKits } from "./editor";

export const metadata: Metadata = { title: "Kits · Galé Comercial" };

export default async function PaginaKits() {
  const supabase = await criarClienteServidor();

  const [{ data: kits }, { data: produtos }] = await Promise.all([
    supabase
      .from("kits")
      .select("id, pecas, descricao, ordem, ativo")
      .order("pecas"),
    // contagem por coluna — ver comentário em cadastros/fabricantes/page.tsx
    supabase.from("produtos").select("kit_id"),
  ]);

  const conta = new Map<number, number>();
  for (const p of produtos ?? []) {
    conta.set(p.kit_id, (conta.get(p.kit_id) ?? 0) + 1);
  }

  const lista = (kits ?? []).map((k) => ({ ...k, usos: conta.get(k.id) ?? 0 }));

  return (
    <div className="px-8 py-7">
      <nav className="mb-3 text-sm text-suave">
        <Link href="/admin/cadastros" className="transition hover:text-texto">
          Cadastros
        </Link>
        <span className="px-1.5 text-tenue">/</span>
        <span className="text-texto">Kits</span>
      </nav>

      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-texto">
          Kits
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-suave">
          Quantas peças vêm em cada kit fechado. Todo produto pertence a um kit,
          e o preço cadastrado é sempre o do kit inteiro — o valor por peça o
          site calcula sozinho.
        </p>
      </header>

      <GerenciadorKits lista={lista} />
    </div>
  );
}
