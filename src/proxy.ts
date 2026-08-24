import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
* Renova o cookie de sessão a cada requisição e barra o acesso ao painel.
 *
 * A checagem aqui é de AUTENTICAÇÃO (está logado?), não de AUTORIZAÇÃO (é
 * admin?). Quem decide se a pessoa é admin é o layout do painel, que consulta
 * o banco — e, na última instância, o próprio RLS. Este arquivo (proxy) não deve
 * consultar tabela: roda em toda requisição e ficaria caro.
 */
/**
 * Endereços do site antigo usavam IDs numéricos:
 *   /produto/1860/slug · /produtos/47/lingerie · /produtos/47/11/tangas adultos
 *
 * O redirecionamento precisa acontecer AQUI para sair como 301 de verdade —
 * dentro da página, o streaming já mandou status 200 antes do redirect.
 * A consulta só roda quando a URL casa com o padrão legado (hoje, tráfego
 * residual de busca), então a regra "proxy não consulta banco" segue valendo
 * para a navegação normal.
 */
async function redirecionarLegado(request: NextRequest) {
  const caminho = request.nextUrl.pathname;

  const buscarSlug = async (tabela: string, legadoId: string) => {
    const url =
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${tabela}` +
      `?legado_id=eq.${legadoId}&select=slug${tabela === "subcategorias" ? ",categorias(slug)" : ""}`;
    const r = await fetch(url, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    });
    if (!r.ok) return null;
    const [linha] = await r.json();
    return linha ?? null;
  };

  let destino: string | null = null;

  const produto = caminho.match(/^\/produto\/(\d+)(?:\/|$)/);
  if (produto) {
    const linha = await buscarSlug("produtos", produto[1]);
    destino = linha ? `/produto/${linha.slug}` : null;
  }

  const subcategoria = caminho.match(/^\/produtos\/\d+\/(\d+)(?:\/|$)/);
  const categoria = caminho.match(/^\/produtos\/(\d+)(?:\/|$)/);
  if (subcategoria) {
    const linha = await buscarSlug("subcategorias", subcategoria[1]);
    destino = linha?.categorias
      ? `/produtos/${linha.categorias.slug}/${linha.slug}`
      : null;
  } else if (categoria) {
    const linha = await buscarSlug("categorias", categoria[1]);
    destino = linha ? `/produtos/${linha.slug}` : null;
  }

  if (destino) {
    const url = request.nextUrl.clone();
    url.pathname = destino;
    url.search = "";
    return NextResponse.redirect(url, 301);
  }
  return null;
}

export async function proxy(request: NextRequest) {
  const caminho0 = request.nextUrl.pathname;
  if (/^\/produtos?\/\d+(\/|$)/.test(caminho0)) {
    const redirecionamento = await redirecionarLegado(request);
    if (redirecionamento) return redirecionamento;
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() valida o token no servidor do Supabase. Não trocar por
  // getSession(), que apenas lê o cookie e pode ser forjado.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const caminho = request.nextUrl.pathname;
  const ehLogin = caminho.startsWith("/admin/login");

  if (caminho.startsWith("/admin") && !ehLogin && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    // guarda para onde a pessoa queria ir, e devolve para lá depois do login
    url.searchParams.set("destino", caminho);
    return NextResponse.redirect(url);
  }

  if (ehLogin && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // tudo, menos estáticos e imagens — eles não precisam de sessão
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)",
  ],
};
