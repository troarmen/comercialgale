import { CONTATO, linkWhatsApp } from "@/lib/contato";
import type { ItemTrilha } from "@/components/catalogo/trilha";

/**
 * SEO do catálogo em um lugar só: endereço canônico e dados estruturados.
 *
 * Regra: JSON-LD só afirma o que o banco afirma. Preço NUNCA entra em dado
 * estruturado — ele é restrito a cliente logado, e schema.org/offers público
 * contradiria (e vazaria) a regra comercial da casa.
 */

export const URL_SITE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.comercialgale.com.br";

export function urlCanonica(caminho: string) {
  return new URL(caminho, URL_SITE).toString();
}

// ------------------------------------------------------------------- JSON-LD

export function dadosOrganizacao() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${URL_SITE}/#organizacao`,
    name: CONTATO.nome,
    legalName: CONTATO.razao,
    url: URL_SITE,
    foundingDate: CONTATO.fundacao,
    email: CONTATO.email,
    telephone: `+55${CONTATO.telefoneFixo.replace(/\D/g, "")}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: CONTATO.endereco.logradouro,
      addressLocality: CONTATO.endereco.cidade,
      addressRegion: CONTATO.endereco.uf,
      addressCountry: "BR",
    },
    sameAs: [CONTATO.instagram, CONTATO.facebook],
  };
}

export function dadosSite() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${URL_SITE}/#site`,
    name: CONTATO.nome,
    url: URL_SITE,
    inLanguage: "pt-BR",
    publisher: { "@id": `${URL_SITE}/#organizacao` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${URL_SITE}/produtos?busca={termo}`,
      },
      "query-input": "required name=termo",
    },
  };
}

export function dadosTrilha(itens: ItemTrilha[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: URL_SITE },
      ...itens.map((item, i) => ({
        "@type": "ListItem",
        position: i + 2,
        name: item.nome,
        ...(item.href ? { item: urlCanonica(item.href) } : {}),
      })),
    ],
  };
}

export function dadosProduto(produto: {
  titulo: string;
  modelo: string;
  slug: string;
  descricao: string | null;
  fabricante: string | null;
  categoria: string | null;
  imagens: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: produto.titulo,
    sku: produto.modelo,
    url: urlCanonica(`/produto/${produto.slug}`),
    ...(produto.descricao ? { description: produto.descricao } : {}),
    ...(produto.fabricante
      ? { brand: { "@type": "Brand", name: produto.fabricante } }
      : {}),
    ...(produto.categoria ? { category: produto.categoria } : {}),
    ...(produto.imagens.length ? { image: produto.imagens } : {}),
  };
}

export function dadosListaProdutos(itens: { nome: string; slug: string }[], caminho: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    url: urlCanonica(caminho),
    numberOfItems: itens.length,
    itemListElement: itens.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.nome,
      url: urlCanonica(`/produto/${p.slug}`),
    })),
  };
}

export function dadosContato() {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    url: urlCanonica("/contato"),
    about: { "@id": `${URL_SITE}/#organizacao` },
  };
}

export { linkWhatsApp };

/** Injeta um bloco JSON-LD na página. */
export function JsonLd({ dados }: { dados: object | object[] }) {
  const lista = Array.isArray(dados) ? dados : [dados];
  return (
    <>
      {lista.map((d, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }}
        />
      ))}
    </>
  );
}
