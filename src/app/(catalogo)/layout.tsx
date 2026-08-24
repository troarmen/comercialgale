import type { Metadata } from "next";
import { Cabecalho } from "@/components/catalogo/cabecalho";
import { BotaoWhatsApp, Rodape } from "@/components/catalogo/rodape";
import { dadosOrganizacao, dadosSite, JsonLd, URL_SITE } from "@/lib/seo";

/**
 * Layout do catálogo público. O painel (/admin) tem o seu próprio e não passa
 * por aqui — este grupo de rota só embrulha as páginas de loja.
 *
 * A LOJA É SEMPRE CLARA: a identidade nova é branco-gelo, e a vitrine não deve
 * escurecer só porque o sistema do visitante está em modo escuro. O script
 * abaixo fixa `data-tema="claro"` ANTES da primeira pintura (ele é o primeiro
 * conteúdo do <body>, então roda antes de qualquer paint) — o mesmo gatilho
 * que o CSS dos tokens já entende. O painel continua com claro/escuro/auto.
 */
const scriptTemaClaro = `document.documentElement.dataset.tema = "claro";`;

export const metadata: Metadata = {
  metadataBase: new URL(URL_SITE),
  title: {
    default:
      "Comercial Galé — Atacado de Lingerie, Meias, Cuecas e Pijamas em São Paulo",
    template: "%s | Comercial Galé",
  },
  description:
    "Distribuidora atacadista de moda íntima desde 1976, na região da 25 de Março, em São Paulo. Lingerie, meias, cuecas e pijamas para lojistas de todo o Brasil.",
  openGraph: {
    type: "website",
    siteName: "Comercial Galé",
    locale: "pt_BR",
  },
  robots: { index: true, follow: true },
};

export default function LayoutCatalogo({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: scriptTemaClaro }} />
      <JsonLd dados={[dadosOrganizacao(), dadosSite()]} />
      <div className="flex min-h-screen flex-col">
        <Cabecalho />
        <main className="flex-1">{children}</main>
        <Rodape />
      </div>
      <BotaoWhatsApp />
    </>
  );
}
