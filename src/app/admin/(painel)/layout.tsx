import { redirect } from "next/navigation";
import { MenuLateral } from "@/components/menu-lateral";
import { perfilEquipe } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { sair } from "../login/acoes";

export default async function LayoutPainel({
  children,
}: {
  children: React.ReactNode;
}) {
  // O proxy garante só que existe sessão. Aqui verificamos se a pessoa é da
  // equipe (admin ou colaborador) — um cliente do catálogo tem login válido e
  // não pode ver estas telas. O que cada papel vê dentro do painel é decidido
  // nas seções (exigirAdminPagina) e, em última instância, pelo RLS.
  const perfil = await perfilEquipe();

  if (!perfil) {
    const supabase = await criarClienteServidor();
    await supabase.auth.signOut();
    redirect("/admin/login");
  }

  const { supabase, user } = perfil;
  const { count: pedidosNovos } = await supabase
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("status", "novo");

  return (
    <div className="flex min-h-screen">
      <MenuLateral
        pedidosNovos={pedidosNovos ?? 0}
        nomeUsuario={perfil.nome ?? user.email ?? "Admin"}
        papel={perfil.papel}
        aoSair={sair}
      />
      <main className="min-w-0 flex-1 bg-fundo">{children}</main>
    </div>
  );
}
