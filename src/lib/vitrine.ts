import "server-only";
import { cache } from "react";
import { urlFoto } from "@/lib/formato";
import { criarClienteAdmin, criarClienteServidor } from "@/lib/supabase/server";

/**
 * Vitrine da loja: os banners do topo da home e o logo, que a equipe troca
 * pelo painel (Vitrine) — pedido do cliente, nov/2026.
 *
 * ONDE MORA: na tabela `configuracoes`, chave/valor JSON, em duas chaves
 * novas — `vitrine_banners` (lista, na ordem de exibição) e `vitrine_logo`
 * (objeto; ausente = logo original). Os arquivos ficam no bucket público
 * `produtos`, sob o prefixo `vitrine/`, com nome único por envio (o arquivo
 * trocado nunca fica preso no cache de ninguém).
 *
 * POR QUE A LOJA LÊ COM A SERVICE ROLE: a política "config publica" do banco
 * só libera três chaves para o visitante (pedido_minimo_valor,
 * catalogo_aviso, exibir_preco_varejo). Abrir as duas novas pediria uma
 * migração, e no banco de produção elas são aplicadas à mão, DEPOIS do
 * deploy — até lá o visitante leria zero linhas e o banner sumiria em
 * silêncio. Lendo no servidor com a chave mestra, funciona com o banco do
 * jeito que está.
 *
 * O preço disso é que este arquivo vira a cerca, e ela tem três tábuas:
 *   • a consulta pede SÓ as chaves de CHAVES_VITRINE (nunca `select *` na
 *     tabela — `emails_notificacao` mora ao lado);
 *   • nada sai cru do banco: todo valor passa pelos leitores abaixo, que
 *     montam um objeto novo só com os campos conhecidos e validados (link
 *     `javascript:`, caminho fora de `vitrine/` ou campo inventado não
 *     atravessam);
 *   • `server-only` faz o build recusar este módulo num componente de
 *     navegador. Componente cliente importa daqui apenas TIPOS.
 *
 * Qualquer falha (chave ausente, JSON torto, banco fora do ar, variável de
 * ambiente faltando) devolve o padrão: sem banner (o topo de sempre) e o logo
 * de /public. A loja nunca quebra por causa da vitrine.
 */

export const CHAVES_VITRINE = ["vitrine_banners", "vitrine_logo"] as const;

/** O painel aceita até quatro banners — mais que isso ninguém vê girar. */
export const MAX_BANNERS = 4;

// ---------------------------------------------------------------- formatos

/** Arquivo guardado: caminho no bucket e tamanho real em pixels. */
export type ImagemVitrine = { caminho: string; largura: number; altura: number };

/**
 * Para onde o banner leva. O produto guarda o ID, e não só o endereço: o
 * slug muda quando o produto é renomeado no painel, e um link fixo viraria
 * 404. O `href` e o `rotulo` são a fotografia do momento em que foi salvo.
 */
export type LinkBanner =
  | { tipo: "externo"; href: string }
  | { tipo: "pagina"; href: string }
  | { tipo: "produto"; produtoId: number; href: string; rotulo: string };

export type BannerGuardado = {
  id: string;
  alt: string;
  ativo: boolean;
  computador: ImagemVitrine;
  celular: ImagemVitrine | null;
  link: LinkBanner | null;
};

export type LogoGuardado = ImagemVitrine & { alt: string };

/** O que a loja recebe: URL pública pronta e link já resolvido. */
export type ImagemLoja = { src: string; largura: number; altura: number };

export type BannerLoja = {
  id: string;
  alt: string;
  computador: ImagemLoja;
  celular: ImagemLoja | null;
  link: { href: string; externo: boolean } | null;
};

export type LogoLoja = ImagemLoja & { alt: string; padrao: boolean };

/** O logo de sempre, em /public — vale quando não há logo configurado. */
export const LOGO_PADRAO: LogoLoja = {
  src: "/logo-gale.webp",
  largura: 276,
  altura: 256,
  alt: "Galé Super Atacado — 50 anos de tradição",
  padrao: true,
};

// ------------------------------------------------------------------- links

// Caractere de controle ou espaço não tem o que fazer num endereço — e é o
// esconderijo clássico de `java\tscript:`.
const INVISIVEL = /[\s\u0000-\u001f\u007f]/;

// `//outro.com` e `/\outro.com`: o navegador lê como OUTRO site.
const OUTRO_SITE = /^\/[\\/]/;

/**
 * Página do próprio site: começa com UMA barra. `//outro.com` e `/\outro.com`
 * ficam de fora. Devolve o caminho normalizado (sem `.` e `..`), ou null se
 * não for um caminho válido.
 *
 * A barra dupla é conferida DE NOVO no resultado: a normalização some com os
 * pontos, e `/.//outro.com` ou `/%2e%2e//outro.com` saem dela como
 * `//outro.com`.
 */
export function normalizarCaminho(texto: string): string | null {
  const t = texto.trim();
  if (!t.startsWith("/") || OUTRO_SITE.test(t) || INVISIVEL.test(t)) return null;
  try {
    const base = "https://loja.invalid";
    const u = new URL(t, base);
    if (u.origin !== base) return null;
    const saida = `${u.pathname}${u.search}${u.hash}`;
    return OUTRO_SITE.test(saida) ? null : saida;
  } catch {
    return null;
  }
}

/**
 * Endereço de outro site: só http/https, sem usuário:senha embutido.
 * Aceita "www.loja.com.br" sem o https:// (o Arthur digita assim).
 */
export function normalizarEnderecoExterno(texto: string): URL | null {
  const t = texto.trim();
  if (!t || INVISIVEL.test(t)) return null;
  const comEsquema = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(comEsquema);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    if (!u.hostname.includes(".")) return null;
    return u;
  } catch {
    return null;
  }
}

/** Conferência final, na leitura: o JSON pode ter sido mexido à mão. */
function hrefSeguro(href: unknown): href is string {
  if (typeof href !== "string" || !href) return false;
  if (href.startsWith("/")) return normalizarCaminho(href) === href;
  return normalizarEnderecoExterno(href)?.toString() === href && /^https?:\/\//i.test(href);
}

// ---------------------------------------------------------------- leitores

function inteiro(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;
}

const CAMINHO_VITRINE = /^vitrine\/[a-z0-9-]+\.(webp|png|jpg)$/;

function lerImagem(v: unknown): ImagemVitrine | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const largura = inteiro(o.largura, 1, 8000);
  const altura = inteiro(o.altura, 1, 8000);
  if (typeof o.caminho !== "string" || !CAMINHO_VITRINE.test(o.caminho)) return null;
  if (!largura || !altura) return null;
  return { caminho: o.caminho, largura, altura };
}

function lerLink(v: unknown): LinkBanner | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!hrefSeguro(o.href)) return null;
  if (o.tipo === "externo" && !o.href.startsWith("/")) return { tipo: "externo", href: o.href };
  if (o.tipo === "pagina" && o.href.startsWith("/")) return { tipo: "pagina", href: o.href };
  if (o.tipo === "produto" && o.href.startsWith("/")) {
    const produtoId = inteiro(o.produtoId, 1, Number.MAX_SAFE_INTEGER);
    if (!produtoId) return null;
    const rotulo = typeof o.rotulo === "string" ? o.rotulo.slice(0, 200) : "";
    return { tipo: "produto", produtoId, href: o.href, rotulo };
  }
  return null;
}

function lerTexto(v: unknown, max: number) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function lerBanners(v: unknown): BannerGuardado[] {
  if (!Array.isArray(v)) return [];
  const lista: BannerGuardado[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const computador = lerImagem(o.computador);
    const alt = lerTexto(o.alt, 200);
    // Sem imagem de computador ou sem texto alternativo, o banner não vai ao ar.
    if (!computador || !alt || typeof o.id !== "string" || !o.id) continue;
    lista.push({
      id: o.id.slice(0, 64),
      alt,
      ativo: o.ativo !== false,
      computador,
      celular: lerImagem(o.celular),
      link: lerLink(o.link),
    });
    if (lista.length === MAX_BANNERS) break;
  }
  return lista;
}

function lerLogo(v: unknown): LogoGuardado | null {
  const imagem = lerImagem(v);
  if (!imagem) return null;
  const alt = lerTexto((v as Record<string, unknown>).alt, 200);
  return { ...imagem, alt: alt || "Comercial Galé" };
}

/**
 * Interpreta as linhas de `configuracoes` da vitrine. Usado pela loja (aqui
 * embaixo) e pelo painel, que lê as mesmas chaves com a sessão do admin.
 */
export function interpretarVitrine(linhas: { chave: string; valor: unknown }[] | null) {
  const mapa = new Map((linhas ?? []).map((l) => [l.chave, l.valor]));
  return {
    banners: lerBanners(mapa.get("vitrine_banners")),
    logo: lerLogo(mapa.get("vitrine_logo")),
  };
}

// ------------------------------------------------------------- leitura loja

/** Uma ida ao banco por requisição, dividida entre cabeçalho, home e rodapé. */
const vitrineGuardada = cache(async () => {
  try {
    const { data, error } = await criarClienteAdmin()
      .from("configuracoes")
      .select("chave, valor")
      .in("chave", [...CHAVES_VITRINE]);
    if (error) throw error;
    return interpretarVitrine(data);
  } catch (erro) {
    console.error("[vitrine] leitura falhou; a loja usa o padrão:", erro);
    return { banners: [] as BannerGuardado[], logo: null };
  }
});

function imagemLoja(i: ImagemVitrine): ImagemLoja {
  return { src: urlFoto(i.caminho)!, largura: i.largura, altura: i.altura };
}

/**
 * Banners ativos, na ordem do painel. O link de produto é resolvido agora,
 * pelo ID, com o cliente PÚBLICO (o RLS só devolve produto ativo): produto
 * renomeado leva ao slug novo; produto desativado deixa o banner sem link
 * em vez de mandar o lojista para um 404.
 */
export const bannersDaLoja = cache(async (): Promise<BannerLoja[]> => {
  const { banners } = await vitrineGuardada();
  const ativos = banners.filter((b) => b.ativo);
  if (!ativos.length) return [];

  const idsProduto = ativos.flatMap((b) =>
    b.link?.tipo === "produto" ? [b.link.produtoId] : [],
  );
  let slugs: Map<number, string> | null = null;
  if (idsProduto.length) {
    try {
      const supabase = await criarClienteServidor();
      const { data, error } = await supabase
        .from("produtos")
        .select("id, slug")
        .in("id", idsProduto)
        .eq("ativo", true);
      if (error) throw error;
      slugs = new Map((data ?? []).map((p) => [p.id, p.slug]));
    } catch (erro) {
      // Sem resposta do banco, fica o endereço gravado no painel.
      console.error("[vitrine] slugs dos produtos dos banners:", erro);
    }
  }

  return ativos.map((b) => {
    let link: BannerLoja["link"] = null;
    if (b.link?.tipo === "externo") link = { href: b.link.href, externo: true };
    if (b.link?.tipo === "pagina") link = { href: b.link.href, externo: false };
    if (b.link?.tipo === "produto") {
      const produtoId = b.link.produtoId;
      const slug = slugs ? slugs.get(produtoId) : null;
      if (slug) link = { href: `/produto/${encodeURIComponent(slug)}`, externo: false };
      else if (!slugs) link = { href: b.link.href, externo: false };
    }
    return {
      id: b.id,
      alt: b.alt,
      computador: imagemLoja(b.computador),
      celular: b.celular ? imagemLoja(b.celular) : null,
      link,
    };
  });
});

/** Logo do cabeçalho, do menu do celular e do rodapé. */
export const logoDaLoja = cache(async (): Promise<LogoLoja> => {
  const { logo } = await vitrineGuardada();
  if (!logo) return LOGO_PADRAO;
  return { ...imagemLoja(logo), alt: logo.alt, padrao: false };
});
