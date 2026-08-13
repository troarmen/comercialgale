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
export async function proxy(request: NextRequest) {
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
