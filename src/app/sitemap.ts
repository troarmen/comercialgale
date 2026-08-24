import type { MetadataRoute } from "next";
import { criarClienteServidor } from "@/lib/supabase/server";
import { URL_SITE } from "@/lib/seo";

/**
 * Sitemap gerado do banco: páginas fixas, categorias, subcategorias, marcas
 * com produto e todos os produtos ativos. O lastModified dos produtos vem do
 * updated_at real.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await criarClienteServidor();

  const [{ data: categorias }, { data: produtos }, { data: fabricantes }, { data: usos }] =
    await Promise.all([
      supabase
        .from("categorias")
        .select("slug, subcategorias(slug, ativo)")
        .eq("ativo", true),
      supabase
        .from("produtos")
        .select("slug, updated_at")
        .eq("ativo", true),
      supabase.from("fabricantes").select("id, slug").eq("ativo", true),
      supabase.from("produtos").select("fabricante_id").eq("ativo", true),
    ]);

  const comProduto = new Set((usos ?? []).map((u) => u.fabricante_id));

  const fixas: MetadataRoute.Sitemap = [
    { url: `${URL_SITE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${URL_SITE}/produtos`, changeFrequency: "daily", priority: 0.9 },
    { url: `${URL_SITE}/lancamentos`, changeFrequency: "daily", priority: 0.8 },
    { url: `${URL_SITE}/marcas`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${URL_SITE}/empresa`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${URL_SITE}/contato`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${URL_SITE}/cadastro`, changeFrequency: "yearly", priority: 0.6 },
  ];

  const deCategorias: MetadataRoute.Sitemap = (categorias ?? []).flatMap((c) => [
    {
      url: `${URL_SITE}/produtos/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    ...(c.subcategorias ?? [])
      .filter((s) => s.ativo)
      .map((s) => ({
        url: `${URL_SITE}/produtos/${c.slug}/${s.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
  ]);

  const deMarcas: MetadataRoute.Sitemap = (fabricantes ?? [])
    .filter((f) => comProduto.has(f.id))
    .map((f) => ({
      url: `${URL_SITE}/marcas/${f.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }));

  const deProdutos: MetadataRoute.Sitemap = (produtos ?? []).map((p) => ({
    url: `${URL_SITE}/produto/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...fixas, ...deCategorias, ...deMarcas, ...deProdutos];
}
