import { redirect } from "next/navigation";
import { MenuLateral } from "@/components/menu-lateral";
import { criarClienteServidor } from "@/lib/supabase/server";
import { sair } from "../login/acoes";

export default async function LayoutPainel({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await criarClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  // O middleware garante só que existe sessão. Aqui verificamos se a pessoa é
  // de fato administradora — um cliente do catálogo tem login válido e não
  // pode ver estas telas.
  const { data: perfil } = await supabase
    .from("profiles")
    .select("nome, role, ativo")
    .eq("id", user.id)
    .single();

  if (!perfil || perfil.role !== "admin" || !perfil.ativo) {
    await supabase.auth.signOut();
    redirect("/admin/login");
  }

  const { count: pedidosNovos } = await supabase
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("status", "novo");

  return (
    <div className="flex min-h-screen">
      <MenuLateral
        pedidosNovos={pedidosNovos ?? 0}
        nomeUsuario={perfil.nome ?? user.email ?? "Admin"}
        aoSair={sair}
      />
      <main className="min-w-0 flex-1 bg-fundo">{children}</main>
    </div>
  );
}
