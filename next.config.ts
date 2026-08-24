import type { NextConfig } from "next";

// Extrai host E protocolo do Supabase da própria variável de ambiente: em
// produção é https, mas o Supabase local de desenvolvimento serve por http.
const urlSupabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: urlSupabase.protocol === "http:" ? "http" : "https",
        hostname: urlSupabase.hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // As fotos já foram convertidas para WebP na migração; o AVIF ainda rende
    // uns 20% a mais em telas pequenas.
    formats: ["image/avif", "image/webp"],
    // O Next 16 bloqueia IP local no otimizador por padrão (proteção SSRF).
    // Só liberamos quando o Supabase É local — em produção fica bloqueado.
    dangerouslyAllowLocalIP: urlSupabase.hostname === "127.0.0.1",
  },
  // Endereços do site antigo que não têm equivalente 1-para-1 no catálogo
  // novo. Categorias e produtos legados (numéricos) são resolvidos pelo
  // banco nas próprias rotas, via legado_id.
  async redirects() {
    return [
      { source: "/cliente/login", destination: "/entrar", permanent: true },
      { source: "/cliente/cadastro", destination: "/cadastro", permanent: true },
      { source: "/cliente/:caminho*", destination: "/conta", permanent: true },
      { source: "/pesquisa", destination: "/produtos", permanent: true },
    ];
  },
  experimental: {
    serverActions: {
      // As fotos sobem por Server Action. O padrão do Next é 1 MB, e mesmo
      // reduzida no navegador uma foto grande passa disso.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
