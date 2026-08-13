import type { Metadata } from "next";
import Link from "next/link";
import { numero } from "@/lib/formato";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cadastros · Galé Comercial" };

const CONTAGEM = { count: "exact", head: true } as const;

export default async function PaginaCadastros() {
  const supabase = await criarClienteServidor();

  const [categorias, subcategorias, fabricantes, tamanhos, kits, semUso] =
    await Promise.all([
      supabase.from("categorias").select("id", CONTAGEM),
      supabase.from("subcategorias").select("id", CONTAGEM),
      supabase.from("fabricantes").select("id", CONTAGEM),
      supabase.from("tamanhos").select("id", CONTAGEM),
      supabase.from("kits").select("id", CONTAGEM),
      // ver comentário na tela de fabricantes: agregado sobre `produtos`
      // é bloqueado pela trava de preço, então contamos pela coluna
      supabase.from("produtos").select("fabricante_id"),
    ]);

  const comProduto = new Set(
    (semUso.data ?? []).map((p) => p.fabricante_id).filter((x) => x != null),
  );
  const fabricantesVazios = (fabricantes.count ?? 0) - comProduto.size;

  const cartoes = [
    {
      href: "/admin/cadastros/fabricantes",
      nome: "Fabricantes",
      total: fabricantes.count ?? 0,
      descricao: "As marcas que a Galé revende.",
      aviso: fabricantesVazios
        ? `${numero(fabricantesVazios)} sem nenhum produto`
        : null,
      pronto: true,
    },
    {
      href: "/admin/cadastros/categorias",
      nome: "Categorias",
      total: categorias.count ?? 0,
      descricao: "Lingerie, Meias, Cuecas, Pijamas e Diversos.",
      aviso: null,
      pronto: true,
    },
    {
      href: "/admin/cadastros/subcategorias",
      nome: "Subcategorias",
      total: subcategorias.count ?? 0,
      descricao: "A divisão dentro de cada categoria.",
      aviso: null,
      pronto: true,
    },
    {
      href: "/admin/cadastros/tamanhos",
      nome: "Tamanhos",
      total: tamanhos.count ?? 0,
      descricao: "Tamanhos, numerações, faixas etárias e grades.",
      aviso: null,
      pronto: true,
    },
    {
      href: "/admin/cadastros/kits",
      nome: "Kits",
      total: kits.count ?? 0,
      descricao: "Quantas peças vêm em cada kit fechado.",
      aviso: null,
      pronto: true,
    },
  ];

  return (
    <div className="px-8 py-7">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-texto">
          Cadastros
        </h1>
        <p className="mt-1 text-sm text-suave">
          A estrutura que organiza o catálogo. Tudo aqui aparece nos filtros da
          loja e no cadastro de produto.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cartoes.map((c) => {
          const conteudo = (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-texto">{c.nome}</span>
                <span className="text-2xl font-semibold tabular-nums text-texto">
                  {numero(c.total)}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-suave">
                {c.descricao}
              </p>
              {c.aviso && (
                <p className="mt-2.5 inline-flex rounded-full bg-alerta-fundo px-2 py-0.5 text-xs font-medium text-alerta-texto">
                  {c.aviso}
                </p>
              )}
              {!c.pronto && (
                <p className="mt-2.5 text-xs text-tenue">Em construção</p>
              )}
            </>
          );

          return c.pronto ? (
            <Link
              key={c.nome}
              href={c.href}
              className="rounded-xl border border-borda bg-superficie p-5 transition hover:border-borda-forte hover:shadow-sm"
            >
              {conteudo}
            </Link>
          ) : (
            <div
              key={c.nome}
              className="rounded-xl border border-borda bg-superficie p-5 opacity-60"
            >
              {conteudo}
            </div>
          );
        })}
      </div>
    </div>
  );
}
