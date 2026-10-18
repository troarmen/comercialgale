"use server";

import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";

export type EstadoSenha = { erro?: string; linkInvalido?: boolean };

/**
 * Cria/troca a senha. Serve ao lojista, ao colaborador e ao admin.
 *
 * Com `token_hash` (veio do e-mail): o token só é consumido AQUI, no envio do
 * formulário — abrir o link não gasta nada (ver src/lib/links-senha.ts).
 * Sem token: vale para quem já está logado e quer trocar a senha.
 */
export async function definirSenha(
  _anterior: EstadoSenha,
  form: FormData,
): Promise<EstadoSenha> {
  const senha = String(form.get("senha") ?? "");
  const confirmacao = String(form.get("confirmacao") ?? "");
  const token = String(form.get("token_hash") ?? "");

  if (senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };
  // bcrypt (usado pelo Auth) ignora o que passa de 72 bytes.
  if (new TextEncoder().encode(senha).length > 72) {
    return { erro: "A senha passou do tamanho máximo. Use até 72 caracteres." };
  }
  if (senha !== confirmacao) return { erro: "As duas senhas não são iguais." };

  const supabase = await criarClienteServidor();

  if (token) {
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: token });
    if (error) return { linkInvalido: true };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { linkInvalido: true };

  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) {
    if (error.code === "same_password") {
      return { erro: "A nova senha precisa ser diferente da anterior." };
    }
    if (error.code === "weak_password") {
      return { erro: "Senha fraca demais. Misture letras e números." };
    }
    console.error("[senha] falha ao trocar:", error.message);
    return { erro: "Não foi possível salvar a senha agora. Tente de novo." };
  }

  // Equipe volta para o painel (o colaborador cai em Pedidos); lojista, para
  // a conta — já logado, com os preços liberados.
  const { data: perfil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const daEquipe = perfil?.role === "admin" || perfil?.role === "colaborador";
  redirect(daEquipe ? "/admin" : "/conta");
}
