import type { Metadata } from "next";
import { urlFoto } from "@/lib/formato";
import { criarClienteServidor } from "@/lib/supabase/server";
import { CHAVES_VITRINE, interpretarVitrine, LOGO_PADRAO, MAX_BANNERS } from "@/lib/vitrine";
import { EditorBanners, type BannerPainel } from "./banners";
import { EditorLogo } from "./logo";

export const metadata: Metadata = { title: "Vitrine · Galé Comercial" };

/**
 * Vitrine: o que a equipe troca na cara da loja sem chamar ninguém — os
 * banners do topo da home e o logo. Tudo mora em `configuracoes` (ver
 * src/lib/vitrine.ts); o painel lê as mesmas chaves com a sessão do admin.
 */
export default async function PaginaVitrine() {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", [...CHAVES_VITRINE]);
  const { banners, logo } = interpretarVitrine(data);

  // Situação ATUAL do produto de cada link: renomeado ou desativado depois
  // de o banner ser salvo, o painel avisa em vez de esconder.
  const idsProduto = banners.flatMap((b) => (b.link?.tipo === "produto" ? [b.link.produtoId] : []));
  const { data: produtos } = idsProduto.length
    ? await supabase
        .from("produtos")
        .select("id, titulo, modelo, ativo")
        .in("id", idsProduto)
    : { data: [] };
  const produtoDe = new Map((produtos ?? []).map((p) => [p.id, p]));

  const lista: BannerPainel[] = banners.map((b) => {
    const produto = b.link?.tipo === "produto" ? produtoDe.get(b.link.produtoId) : null;
    return {
      ...b,
      urlComputador: urlFoto(b.computador.caminho)!,
      urlCelular: urlFoto(b.celular?.caminho),
      produtoLink:
        b.link?.tipo === "produto"
          ? {
              id: b.link.produtoId,
              rotulo: produto ? `${produto.modelo} — ${produto.titulo}` : b.link.rotulo,
              ativo: !!produto?.ativo,
              existe: !!produto,
            }
          : null,
    };
  });

  return (
    <div className="px-8 py-7">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-texto">Vitrine</h1>
        <p className="mt-1 max-w-2xl text-sm text-suave">
          O que aparece logo na entrada da loja: os banners do topo da página
          inicial e o logo do cabeçalho e do rodapé. As mudanças valem na hora.
        </p>
      </header>

      <div className="flex max-w-5xl flex-col gap-5">
        <EditorBanners banners={lista} maximo={MAX_BANNERS} />
        <EditorLogo
          atual={
            logo
              ? {
                  src: urlFoto(logo.caminho)!,
                  largura: logo.largura,
                  altura: logo.altura,
                  alt: logo.alt,
                  padrao: false,
                }
              : LOGO_PADRAO
          }
        />
      </div>
    </div>
  );
}
