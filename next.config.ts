import type { NextConfig } from "next";

// Extrai o host do Supabase da própria variável de ambiente, para não repetir
// o endereço aqui e ele sair do lugar quando trocarmos de projeto.
const hostSupabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: hostSupabase,
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // As fotos já foram convertidas para WebP na migração; o AVIF ainda rende
    // uns 20% a mais em telas pequenas.
    formats: ["image/avif", "image/webp"],
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
